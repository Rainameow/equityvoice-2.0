# EquityVoice 2.0 — clean rebuild starter

A redesigned **Next.js frontend** connected to the existing **FastAPI** payroll backend. The old project has not been overwritten.

## What is implemented
- Polished responsive dashboard with live `/summary`, `/gaps`, `/breakdown` results; no mock metric values.
- CSV/Excel upload → validate → confirm → refresh dashboard.
- Share My Pay form connected to `/submit` (backend minimum aggregate size is 5).
- Compensation conversation coach with **deterministic, live-statistic-based** guidance. **Not a Groq/ElevenLabs agent yet.**
- Next.js server-side API proxy (`/api/backend/*`) so browser requests use the same origin.
- Existing FastAPI code and synthetic CSV scenarios retained in `backend/`.

## Run locally (two terminals)

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export ID_SALT='replace-with-a-long-random-private-value'
uvicorn server:app --reload --port 8000
```
The backend requires `ID_SALT`. `GROQ_API_KEY` is not needed for the dashboard. On first start, `company.db` may not exist; use Payroll studio to upload a CSV. SQLite is local and **not** a secure production database.

### Frontend
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
Open http://localhost:3000. The frontend proxies requests to `http://127.0.0.1:8000`.

## Deploy later
- Set `BACKEND_URL` in the frontend hosting environment to your deployed backend URL.
- Deploy frontend on Vercel and backend on a persistent Python service (Render/Railway). The proxy route prevents browser CORS problems, but does not solve database persistence.
- Do not expose real payroll data publicly without authentication, authorization, data minimization and a durable secure database.

## Important limitations
- Voice simulation is a designed placeholder; ElevenLabs is **not integrated**.
- The coach currently uses calculated summaries, not generative AI. It is labeled accordingly in the UI.
- Charts use the existing backend's gender and job-level breakdown. Ethnicity, department and time-series analytics need backend endpoints before those charts can honestly display real values.
- The backend still contains the original legacy HTML and uses SQLite. Future refactor should move its modules into services/routes and replace database storage only after tests pass.
- Existing backend supports `.csv`, `.xlsx`, `.xlsm` up to 10 MB. Large Excel sample may exceed this limit.
