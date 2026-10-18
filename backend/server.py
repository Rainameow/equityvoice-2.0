
import json
import os
import re
import sqlite3
import tempfile
import uuid

from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Literal

import pandas as pd

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

import urllib.request
import urllib.error

from pydantic import BaseModel, Field, ValidationError

import build_db
import main as form


# ==========================================
# CONFIGURATION
# ==========================================

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "company.db"
HTML_PATH = BASE_DIR / "equityvoice-dashboard.html"

if not os.environ.get("ID_SALT"):
    raise RuntimeError(
        "Set ID_SALT before starting the server."
    )

MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

PERIODS = {
    "annual": 1,
    "monthly": 12,
    "semimonthly": 24,
    "biweekly": 26,
    "weekly": 52,
    "hourly": 2080
}

LEVELS = [
    "Entry",
    "Mid",
    "Senior",
    "Management",
    "Executive"
]

GENDERS = [
    "Female",
    "Male",
    "Nonbinary",
    "Undisclosed"
]

MAX_BYTES = 10_000_000
MIN_GROUP_SIZE = 5

app = FastAPI(
    title="EquityVoice API",
    description="Payroll analysis and pay equity dashboard",
    version="1.1.0"
)

# Allow the Vercel frontend to call the Render API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://equityvoice.vercel.app",
    ],
    allow_origin_regex=r"https://equityvoice-[a-z0-9-]+-rainameow\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

PENDING = {}


# ==========================================
# PYDANTIC MODELS
# ==========================================

class Columns(BaseModel):
    id: str | None
    gender: str | None
    age: str | None
    dob: str | None
    position: str | None
    level: str | None
    salary: str | None
    disability: str | None
    race: str | None = None


class Mapping(BaseModel):
    header_row: int
    columns: Columns
    salary_period: str


class Pair(BaseModel):
    raw: str
    value: str


class Norm(BaseModel):
    gender_map: list[Pair]
    disability_map: list[Pair]
    level_map: list[Pair]


class Employee(BaseModel):
    id: str
    gender: Literal[
        "Female",
        "Male",
        "Nonbinary",
        "Undisclosed"
    ]
    age: int = Field(ge=16, le=100)
    position: str
    level: Literal[
        "Entry",
        "Mid",
        "Senior",
        "Management",
        "Executive"
    ]
    salary: float = Field(gt=0)
    disability: bool
    race: str | None = None


# ==========================================
# OPTIONAL GROQ HELPER (headers only; never sends employee rows)
# ==========================================

def ask(schema, prompt):
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise ValueError("Groq key unavailable; using automatic column detection")
    payload = {
        "model": MODEL,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": "Return ONLY a valid JSON object. Do not invent missing columns."},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=12) as response:
        result = json.load(response)
    return schema.model_validate_json(result["choices"][0]["message"]["content"])


# ==========================================
# ==========================================
# READ PAYROLL FILE
# ==========================================

def load_raw(data, name):
    if name.endswith((".xlsx", ".xlsm")):
        sheets = pd.read_excel(
            BytesIO(data),
            sheet_name=None,
            header=None,
            dtype=str
        )

        if not sheets:
            raise ValueError("Excel workbook has no sheets.")

        df = max(
            sheets.values(),
            key=lambda frame: frame.size
        )

    else:
        df = pd.read_csv(
            BytesIO(data),
            header=None,
            dtype=str,
            sep=None,
            engine="python"
        )

    df = (
        df.dropna(how="all")
          .dropna(axis=1, how="all")
          .reset_index(drop=True)
    )

    if df.empty:
        raise ValueError("The uploaded file is empty.")

    return df


# ==========================================
# DETECT COLUMN MAPPING
# ==========================================

def _key(value):
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


ALIASES = {
    "id": ["id", "employeeid", "empid", "workerid", "staffid", "personnelid"],
    "gender": ["gender", "sex", "genderidentity"],
    "age": ["age", "employeeage"],
    "dob": ["dob", "dateofbirth", "birthdate"],
    "position": ["position", "jobtitle", "title", "role", "jobrole", "jobposition"],
    "level": ["level", "seniority", "senioritylevel", "joblevel", "grade", "careerlevel"],
    "salary": ["salary", "annualsalary", "basesalary", "basepay", "pay", "compensation", "annualpay", "wage"],
    "disability": ["disability", "disabilitystatus", "hasdisability", "disabled"],
    "race": ["race", "ethnicity", "raceethnicity", "raceorethnicity", "racialgroup", "ethnicgroup"],
}


def get_mapping(raw):
    best = None
    best_score = -1
    for i in range(min(12, len(raw))):
        headers = [str(x).strip() for x in raw.iloc[i].tolist()]
        lookup = {_key(h): h for h in headers if h and h.lower() != "nan"}
        found = {}
        for field, aliases in ALIASES.items():
            found[field] = next((lookup[a] for a in aliases if a in lookup), None)
        score = sum(found[f] is not None for f in ("id", "gender", "position", "salary"))
        score += sum(found[f] is not None for f in ("age", "dob", "level", "disability", "race")) * .1
        if score > best_score:
            best = (i, found, headers)
            best_score = score
    header_row, columns, headers = best
    # Ask Groq ONLY about column names when simple matching missed required fields.
    if any(not columns[f] for f in ("id", "gender", "position", "salary")) or not (columns["age"] or columns["dob"]):
        try:
            prompt = (
                "Map these CSV headers to fields id, gender, age, dob, position, "
                "level, salary, disability, race. Respond with JSON keys header_row "
                "(integer), columns (object with all nine keys, values exact "
                "header strings or null), salary_period (annual, monthly, "
                "semimonthly, biweekly, weekly, hourly). "
                "Do not invent headers. Headers: " + json.dumps(headers)
                + f". Header row index: {header_row}"
            )
            proposed = ask(Mapping, prompt).model_dump()
            allowed = set(headers)
            for field in columns:
                value = proposed["columns"].get(field)
                if not columns[field] and value in allowed:
                    columns[field] = value
        except Exception:
            pass  # Groq limits/errors never block normal uploads.
    salary_name = _key(columns.get("salary") or "")
    period = "annual"
    for token, value in (("hour", "hourly"), ("biweek", "biweekly"),
                         ("semimonth", "semimonthly"), ("month", "monthly"),
                         ("week", "weekly")):
        if token in salary_name:
            period = value
            break
    return {"header_row": header_row, "columns": columns, "salary_period": period}


# ==========================================
# ==========================================
# EXTRACT COLUMNS
# ==========================================

def extract(raw, mapping):
    header_row = mapping["header_row"]

    if not 0 <= header_row < len(raw):
        raise ValueError("Invalid header row.")

    df = raw.iloc[header_row + 1:].copy()

    df.columns = (
        raw.iloc[header_row]
        .astype(str)
        .str.strip()
    )

    columns = {
        key: value
        for key, value in mapping["columns"].items()
        if value
    }

    missing = [
        value
        for value in columns.values()
        if value not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Mapped columns not found: {missing}"
        )

    required = [
        "id",
        "gender",
        "position",
        "salary"
    ]

    missing_required = [
        key
        for key in required
        if key not in columns
    ]

    if missing_required:
        raise ValueError(
            f"Missing required fields: {missing_required}"
        )

    if "age" not in columns and "dob" not in columns:
        raise ValueError(
            "Payroll needs an age or date-of-birth column."
        )

    return pd.DataFrame({
        key: df[value].values
        for key, value in columns.items()
    })


# ==========================================
# NORMALIZE CATEGORIES LOCALLY
# ==========================================

def get_norm(table, mapping):
    def unique(field):
        if field not in table:
            return []
        return table[field].dropna().astype(str).str.strip().unique().tolist()

    def gender(value):
        k = _key(value)
        if k in ("f", "female", "woman", "women"):
            return "Female"
        if k in ("m", "male", "man", "men"):
            return "Male"
        if k in ("nb", "nonbinary", "nonbinarygender", "genderqueer"):
            return "Nonbinary"
        return "Undisclosed"

    def disability(value):
        k = _key(value)
        if k in ("yes", "y", "true", "1", "disabled", "hasdisability"):
            return True
        if k in ("no", "n", "false", "0", "notdisabled", "nodisability", "none"):
            return False
        # Unknown values are not automatically treated as 'no'.
        return None

    def level(value):
        k = str(value).strip().lower()
        compact = _key(value)
        # Numeric job grades in payroll exports: 1=Entry through 5=Executive.
        # Preserve the existing handling of descriptive levels (L1, Senior, etc.).
        numeric_levels = {"1": "Entry", "2": "Mid", "3": "Senior", "4": "Management", "5": "Executive"}
        if compact in numeric_levels:
            return numeric_levels[compact]
        if compact in ("entry", "junior", "jr", "intern", "associate", "l1", "level1") or any(
            w in k for w in ("entry", "junior", "intern", "trainee")):
            return "Entry"
        if compact in ("mid", "intermediate", "l2", "level2") or "mid" in k:
            return "Mid"
        if compact in ("senior", "sr", "l3", "level3") or any(
            w in k for w in ("senior", "principal", "staff ", "lead ")):
            return "Senior"
        if compact in ("management", "manager", "l4", "level4") or any(
            w in k for w in ("manager", "director", "head of")):
            return "Management"
        if compact in ("executive", "l5", "level5") or any(
            w in k for w in ("chief", "vice president", "vp ", "president", "executive", "ceo", "cto", "cfo")):
            return "Executive"
        return None

    def race(value):
        if pd.isna(value):
            return None
        text = str(value).strip()
        if _key(text) in ("", "nan", "none", "null", "unknown", "undisclosed", "prefernottoanswer", "notreported"):
            return None
        # Retain the supplied category, rather than guessing someone's ethnicity.
        return text[:100]

    source = "level" if mapping["columns"].get("level") else "position"
    return {
        "gender_map": {v: gender(v) for v in unique("gender")},
        "disability_map": {v: disability(v) for v in unique("disability")},
        "level_map": {v: level(v) for v in unique(source)},
        "race_map": {v: race(v) for v in unique("race")},
    }


# ==========================================
# ==========================================
# SALARY PARSING
# ==========================================

def num(value):
    try:
        result = float(
            re.sub(
                r"[^\d.\-]",
                "",
                str(value)
            )
        )

        if not pd.notna(result):
            return None

        return result

    except (ValueError, TypeError):
        return None


# ==========================================
# VALIDATE EMPLOYEE RECORDS
# ==========================================

def build_records(table, mapping, norm):
    factor = PERIODS[mapping["salary_period"]]
    today = date.today()

    accepted = []
    rejected = []

    for index, row in table.iterrows():
        try:
            raw_age = num(row.get("age"))

            if raw_age is not None:
                age = int(raw_age)

            else:
                dob = pd.to_datetime(
                    row.get("dob"),
                    errors="coerce"
                )

                if pd.isna(dob):
                    age = None

                else:
                    age = (
                        today.year
                        - dob.year
                        - (
                            (today.month, today.day)
                            < (dob.month, dob.day)
                        )
                    )

            level_source = (
                row.get("level")
                if mapping["columns"]["level"]
                else row.get("position")
            )

            salary = num(row.get("salary"))

            employee_id = str(
                row.get("id", "")
            ).strip()

            if not employee_id or employee_id.lower() in {
                "nan",
                "none",
                "null"
            }:
                raise ValueError("Missing employee ID")

            position = str(
                row.get("position", "")
            ).strip()

            if not position or position.lower() in {
                "nan",
                "none",
                "null"
            }:
                raise ValueError("Missing position")

            record = Employee(
                id=employee_id,
                gender=norm["gender_map"].get(
                    str(row.get("gender", "")).strip(),
                    "Undisclosed"
                ),
                age=age,
                position=position,
                level=norm["level_map"].get(
                    str(level_source).strip()
                ),
                salary=(
                    None
                    if salary is None
                    else round(salary * factor, 2)
                ),
                disability=norm["disability_map"].get(
                    str(row.get("disability", "")).strip()
                ),
                race=norm["race_map"].get(str(row.get("race", "")).strip())
            )

            accepted.append(record.model_dump())

        except (
            ValidationError,
            TypeError,
            ValueError
        ) as error:

            rejected.append({
                "row": int(index),
                "error": str(error)[:200]
            })

    return accepted, rejected


# ==========================================
# UPLOAD PAYROLL
# ==========================================

@app.post("/upload")
def upload(file: UploadFile = File(...)):

    name = (file.filename or "").lower()

    if not name.endswith((
        ".csv",
        ".xlsx",
        ".xlsm"
    )):
        raise HTTPException(
            400,
            "Upload a CSV or Excel file."
        )

    data = file.file.read(MAX_BYTES + 1)

    if len(data) > MAX_BYTES:
        raise HTTPException(
            413,
            "File is too large (10 MB max)."
        )

    try:
        raw = load_raw(data, name)

        mapping = get_mapping(raw)

        table = extract(raw, mapping)

        norm = get_norm(table, mapping)

        records, errors = build_records(
            table,
            mapping,
            norm
        )

    except Exception as error:
        raise HTTPException(
            422,
            f"Could not read this file: {str(error)[:200]}"
        )

    total = len(records) + len(errors)

    can_confirm = (
        bool(records)
        and total > 0
        and len(errors) / total <= 0.05
    )

    upload_id = uuid.uuid4().hex

    PENDING[upload_id] = {
        "records": records,
        "ok": can_confirm
    }

    return {
        "id": upload_id,
        "mapping": mapping,
        "level_map": norm["level_map"],
        "accepted": len(records),
        "rejected": len(errors),
        "rejected_sample": errors[:5],
        "can_confirm": can_confirm
    }


# ==========================================
# CONFIRM PAYROLL
# ==========================================

@app.post("/confirm/{pid}")
def confirm(pid: str):

    pending = PENDING.get(pid)

    if not pending or not pending["ok"]:
        raise HTTPException(
            404,
            "This upload expired. Please upload again."
        )

    fd, path = tempfile.mkstemp(
        suffix=".json"
    )

    try:
        with os.fdopen(fd, "w") as file:
            json.dump(
                pending["records"],
                file
            )

        build_db.main(path)

    except Exception as error:
        raise HTTPException(
            500,
            f"Could not load payroll: {str(error)[:200]}"
        )

    finally:
        if os.path.exists(path):
            os.remove(path)

    PENDING.pop(pid, None)

    return {
        "employees": len(pending["records"]),
        "status": "loaded"
    }


# ==========================================
# DATABASE HELPER
# ==========================================

def get_connection():

    if not DB_PATH.exists():
        raise HTTPException(
            404,
            "No payroll database loaded yet."
        )

    try:
        return sqlite3.connect(
            f"file:{DB_PATH}?mode=ro",
            uri=True
        )

    except sqlite3.Error:
        raise HTTPException(
            500,
            "Could not connect to payroll database."
        )


def get_payroll_rows():
    connection = get_connection()

    try:
        rows = connection.execute("""
            SELECT
                gender,
                level,
                annual_salary
            FROM v_pay
        """).fetchall()

        return [
            (gender, level, float(salary))
            for gender, level, salary in rows
            if salary is not None
        ]

    except sqlite3.Error as error:
        raise HTTPException(
            500,
            f"Payroll query failed: {str(error)}"
        )

    finally:
        connection.close()


# ==========================================
# PAY GAP HELPERS
# ==========================================

def mean(values):
    if not values:
        return None

    return sum(values) / len(values)


def calculate_gap(
    group_a,
    group_b,
    min_size=MIN_GROUP_SIZE
):
    if (
        len(group_a) < min_size
        or len(group_b) < min_size
    ):
        return None

    avg_a = mean(group_a)
    avg_b = mean(group_b)

    if avg_b is None or avg_b <= 0:
        return None

    return round(
        (avg_b - avg_a) / avg_b * 100,
        1
    )


# ==========================================
# REAL PAY GAP SUMMARY
# ==========================================

@app.get("/gaps")
def gaps():

    rows = get_payroll_rows()

    connection = get_connection()

    try:
        disability_rows = connection.execute("""
            SELECT
                d.has_disability,
                p.annual_salary
            FROM disability_status d
            JOIN payroll p
                USING(employee_id)
        """).fetchall()

    except sqlite3.Error as error:
        raise HTTPException(
            500,
            f"Disability query failed: {str(error)}"
        )

    finally:
        connection.close()

    levels = {}
    weighted_total = 0
    weighted_count = 0

    for level in LEVELS:

        female = [
            salary
            for gender, employee_level, salary in rows
            if gender == "Female"
            and employee_level == level
        ]

        male = [
            salary
            for gender, employee_level, salary in rows
            if gender == "Male"
            and employee_level == level
        ]

        level_gap = calculate_gap(
            female,
            male
        )

        levels[level] = level_gap

        if level_gap is not None:
            count = len(female) + len(male)

            weighted_total += level_gap * count
            weighted_count += count

    women_gap = (
        round(weighted_total / weighted_count, 1)
        if weighted_count
        else None
    )

    disability_gap = calculate_gap(
        [
            salary
            for status, salary in disability_rows
            if status == 1 and salary is not None
        ],
        [
            salary
            for status, salary in disability_rows
            if status == 0 and salary is not None
        ]
    )

    return {
        "headcount": len(rows),
        "women_gap": women_gap,
        "by_level": levels,
        "disability_gap": disability_gap
    }


# ==========================================
# REAL BREAKDOWN BY LEVEL
# ==========================================

@app.get("/breakdown")
def breakdown():

    rows = get_payroll_rows()

    results = []

    for level in LEVELS:

        employees = [
            (gender, salary)
            for gender, employee_level, salary in rows
            if employee_level == level
        ]

        female = [
            salary
            for gender, salary in employees
            if gender == "Female"
        ]

        male = [
            salary
            for gender, salary in employees
            if gender == "Male"
        ]

        gap_value = calculate_gap(
            female,
            male
        )

        results.append({
            "level": level,
            "headcount": len(employees),
            "female_count": len(female),
            "male_count": len(male),
            "women_gap": gap_value
        })

    return {
        "headcount": len(rows),
        "breakdown": results
    }


# ==========================================
# REAL SUMMARY STATS
# ==========================================

@app.get("/summary")
def summary():

    rows = get_payroll_rows()

    women = [
        salary
        for gender, level, salary in rows
        if gender == "Female"
    ]

    men = [
        salary
        for gender, level, salary in rows
        if gender == "Male"
    ]

    return {
        "headcount": len(rows),
        "women_count": len(women),
        "men_count": len(men),
        "average_salary": (
            round(mean([row[2] for row in rows]), 2)
            if rows else None
        ),
        "average_women_salary": (
            round(mean(women), 2)
            if women else None
        ),
        "average_men_salary": (
            round(mean(men), 2)
            if men else None
        ),
        "unadjusted_women_gap": calculate_gap(
            women,
            men
        )
    }


# ==========================================
# EXTENDED EQUITY ANALYTICS (privacy-aware)
# ==========================================

@app.get("/equity-details")
def equity_details():
    """Privacy-thresholded aggregates only; never returns employee salary rows."""
    rows = get_payroll_rows()
    gender_result = []
    for level in LEVELS:
        women = [s for g, lev, s in rows if lev == level and g == "Female"]
        men = [s for g, lev, s in rows if lev == level and g == "Male"]
        gender_result.append({
            "level": level,
            "women_count": len(women) if len(women) >= MIN_GROUP_SIZE else None,
            "men_count": len(men) if len(men) >= MIN_GROUP_SIZE else None,
            "pay_gap_percent": calculate_gap(women, men),
        })

    connection = get_connection()
    try:
        disability_rows = connection.execute("""
            SELECT d.has_disability, p.annual_salary
            FROM disability_status d
            JOIN payroll p USING(employee_id)
            WHERE p.annual_salary IS NOT NULL
        """).fetchall()
        # Older databases may not have race yet. Re-upload and confirm to rebuild.
        has_race = any(c[1] == "race" for c in connection.execute("PRAGMA table_info(employees)"))
        race_rows = connection.execute("""
            SELECT e.race, e.gender, pos.level, p.annual_salary
            FROM employees e
            JOIN positions pos ON pos.position_id = e.position_id
            JOIN payroll p ON p.employee_id = e.employee_id
            WHERE e.race IS NOT NULL AND TRIM(e.race) != ''
        """).fetchall() if has_race else []
    except sqlite3.Error:
        raise HTTPException(500, "Equity analysis query failed")
    finally:
        connection.close()

    with_disability = [float(s) for status, s in disability_rows if status == 1]
    without_disability = [float(s) for status, s in disability_rows if status == 0]
    # Require enough people in both compared groups; never show individual pay.
    race_categories = sorted({race for race, _, _, _ in race_rows})
    race_groups = []
    intersection_groups = []
    for race in race_categories:
        group = [(g, level, float(s)) for r, g, level, s in race_rows if r == race]
        if len(group) < MIN_GROUP_SIZE:
            continue
        race_groups.append({"race": race, "headcount": len(group),
                            "average_salary": round(mean([s for _, _, s in group]), 2)})
        for level in LEVELS:
            women = [s for g, lev, s in group if g == "Female" and lev == level]
            men = [s for g, lev, s in group if g == "Male" and lev == level]
            gap = calculate_gap(women, men)
            if gap is not None:
                intersection_groups.append({"race": race, "level": level,
                                            "women_count": len(women), "men_count": len(men),
                                            "pay_gap_percent": gap})

    return {
        "headcount": len(rows),
        "minimum_group_size": MIN_GROUP_SIZE,
        "gender": {"by_level": gender_result},
        "disability": {
            "with_disability_count": len(with_disability) if len(with_disability) >= MIN_GROUP_SIZE else None,
            "without_disability_count": len(without_disability) if len(without_disability) >= MIN_GROUP_SIZE else None,
            "pay_gap_percent": calculate_gap(with_disability, without_disability),
            "note": "Unadjusted overall comparison; not adjusted for job level.",
        },
        "race": {
            "available": bool(race_groups),
            "groups": race_groups,
            "note": "Unadjusted group average salaries; not evidence of causation.",
            "reason": None if race_groups else "No qualifying race/ethnicity groups in current payroll. Re-upload a dataset with a race or ethnicity column.",
        },
        "intersectional": {
            "available": bool(intersection_groups),
            "by_race_and_level": intersection_groups,
            "note": "Women-versus-men mean pay gaps within each race and job level; both groups must have at least five employees.",
            "reason": None if intersection_groups else "No race-by-level groups have at least five women and five men.",
        },
    }


# ==========================================
# SALARY SUBMISSION ROUTES
# ==========================================

app.add_api_route(
    "/submit",
    form.submit,
    methods=["POST"]
)

app.add_api_route(
    "/stats/{position}",
    form.stats,
    methods=["GET"]
)


# ==========================================
# FRONTEND
# ==========================================

@app.get("/")
def home():

    if not HTML_PATH.exists():
        raise HTTPException(
            404,
            "Dashboard HTML file not found."
        )

    return FileResponse(HTML_PATH)


# ==========================================
# HEALTH CHECK
# ==========================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "database_exists": DB_PATH.exists(),
        "model": MODEL
    }


# ==========================================
# LOCAL DEVELOPMENT
# ==========================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000
    )
