# Audit Compliance Checker

A web application that automates healthcare regulatory compliance auditing. Upload an audit questionnaire PDF and your organization's policy documents, and the app analyzes each requirement against your policies using AI.

## How It Works

1. **Upload** your audit questions PDF (e.g., a DHCS Submission Review Form)
2. **Upload** one or more Policy & Procedure PDFs
3. **Analyze** — the app checks each audit question against your policies using Google Gemini
4. **Review** results with compliance status, evidence citations, and confidence scores

## Tech Stack

- **Frontend**: React + TypeScript, Vite, Tailwind CSS
- **Backend**: Python, FastAPI
- **AI**: Google Gemini 2.5 Flash
- **Hosting**: Vercel (frontend) + Railway (backend)

## Local Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
GEMINI_API_KEY=your-key-here uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and expects the backend at `http://localhost:8000`.

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `GEMINI_API_KEY` | Backend | Google AI API key |
| `CORS_ORIGINS` | Backend | Comma-separated allowed origins |
| `VITE_API_URL` | Frontend | Backend URL (e.g., `https://your-app.railway.app`) |
