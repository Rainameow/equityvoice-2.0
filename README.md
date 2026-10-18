# EquityVoice — AI-Powered Pay Equity Analytics

**Turning payroll data into clarity, transparency, and action.**

🌐 **Live Demo:** https://equityvoice-2-0.vercel.app

## Overview

EquityVoice is a full-stack pay equity analytics platform designed to help organizations identify, explore, and better understand compensation disparities.

By combining interactive data visualizations, payroll analysis, and conversational AI, EquityVoice makes complex compensation data easier to interpret and helps users have more informed conversations about fair pay.

Built as a hackathon project, EquityVoice demonstrates how technology can make compensation transparency more accessible.

## Key Features

### Interactive Analytics Dashboard
- Analyze compensation patterns across employee records.
- View average salaries, gender pay gaps, and workforce demographics.
- Compare salary differences across job levels.
- Explore insights through interactive charts and visualizations.

### Payroll Studio
- Upload payroll datasets in CSV or Excel format.
- Validate records before publishing.
- Update the dashboard using newly uploaded data.
- Explore different compensation scenarios using synthetic datasets.

### Pay Gap Investigation
- Explore compensation disparities beyond headline statistics.
- Investigate workforce patterns and demographic comparisons.
- Identify areas that may require further review.

### Emma — AI Compensation Advisor
- Integrated with **ElevenLabs Conversational AI** for real-time voice interactions.
- Answers questions about compensation and pay equity.
- Connects to backend analytics to retrieve dataset-based statistics.
- Supports practicing workplace compensation conversations.

*Live voice conversations require available ElevenLabs credits. The written guidance feature uses calculated payroll statistics rather than a generative chatbot.*

### Scenario Studio
Explore compensation scenarios and potential approaches to improving pay equity.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | Python, FastAPI |
| Database | SQLite |
| Voice AI | ElevenLabs Conversational AI |
| Data Analysis | Python, SQL |
| Frontend Deployment | Vercel |
| Backend Deployment | Render |
| Version Control | Git, GitHub |

## How It Works

1. **Upload:** Import a synthetic or authorized payroll dataset.
2. **Validate:** Review records before confirming the upload.
3. **Analyze:** The backend calculates compensation metrics and demographic breakdowns.
4. **Explore:** Visualize results through the dashboard and investigation tools.
5. **Ask:** Use Emma to discuss findings or practice compensation-related conversations.

## Getting Started

### Prerequisites
- Node.js and npm
- Python 3
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/Rainameow/equityvoice-2-0.git
cd equityvoice-2-0
```

### 2. Start the Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export ID_SALT='replace-with-a-long-random-private-value'
uvicorn server:app --reload --port
