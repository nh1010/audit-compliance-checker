# Audit Compliance Checker

A web application that automates healthcare regulatory compliance auditing. Upload an audit questionnaire PDF and the app analyzes each requirement against pre-indexed policy documents using AI.

## How It Works

1. **Upload** your audit questions PDF (e.g., a DHCS Submission Review Form)
2. **Analyze** — the app retrieves relevant policy excerpts via vector search and checks each question using Google Gemini
3. **Review** results with compliance status, evidence citations, and confidence scores

## Tech Stack

- **Frontend**: React 19 + TypeScript, Vite, Tailwind CSS v4, Lucide icons
- **Backend**: Python 3.12, FastAPI, pdfplumber, Pydantic v2
- **Vector DB**: ChromaDB (persistent, stored on a Docker volume)
- **Embeddings**: Google `gemini-embedding-001`
- **AI**: Google Gemini 2.5 Flash (via `google-genai` SDK)
- **Hosting**: Vercel (frontend) + Railway (backend)

## Architecture

```
frontend/          React SPA (Vite)
├── src/
│   ├── components/  UploadScreen, ScanScreen, DebriefScreen
│   ├── hooks/       useAudit (state machine driving the audit flow)
│   └── lib/         API client, shared types

backend/           FastAPI service (Docker)
├── app/
│   ├── routers/   upload, audit (parse questions), analyze (SSE streaming)
│   ├── services/  gemini (AI analysis), pdf_parser, vector_store (ChromaDB)
│   └── models/    Pydantic schemas
├── scripts/       ingest_policies.py (indexes PDFs on startup or via CLI)
├── policies/      Policy PDFs (gitignored, local only)
└── data/chroma/   ChromaDB index (persisted via Docker volume, gitignored)
```

### Data Flow

```
Upload PDF → parse questions → vector search policies → Gemini analysis → SSE stream → Results UI
```

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload an audit questions PDF (returns `file_id`) |
| `POST` | `/api/audit/parse` | Parse audit questions from an uploaded PDF |
| `POST` | `/api/analyze` | Analyze questions against indexed policies (SSE stream) |
| `GET`  | `/health` | Health check |

## Local Development

### 1. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set your GEMINI_API_KEY
```

### 2. Add policy documents

Place your P&P PDFs in `backend/policies/`. Subdirectories are supported.

### 3. Build and start the backend

```bash
docker compose up --build
```

On startup the backend automatically ingests any new policy PDFs from `backend/policies/` (or from R2 if configured) and indexes them into ChromaDB. The ChromaDB index is persisted on a named Docker volume (`chroma-data`) so re-indexing only happens when new PDFs are added.

The FastAPI server starts on `http://localhost:8000`.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and expects the backend at `http://localhost:8000`.

### Without Docker

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m scripts.ingest_policies    # build the index
uvicorn app.main:app --reload        # start the server
```

### Updating policies

Add or replace PDFs in `backend/policies/`, then restart:

```bash
docker compose restart
```

## Deployment

### Backend (Railway)

1. Push to GitHub (policy PDFs are gitignored; use R2 for production policies)
2. On [Railway](https://railway.app), create a new project from the repo
3. Add environment variables:
   - `GEMINI_API_KEY` — your Google AI API key
   - `CORS_ORIGINS` — your Vercel frontend URL (e.g., `https://your-app.vercel.app`)
   - R2 variables (optional) — `R2_BUCKET`, `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PREFIX` for cloud policy storage
4. Deploy — Railway uses `railway.toml` to locate the Dockerfile and health check

### Frontend (Vercel)

1. Import the repo on [Vercel](https://vercel.com)
2. Set the **Root Directory** to `frontend/`
3. Add the environment variable:
   - `VITE_API_URL` — your Railway backend URL
4. Deploy

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `GEMINI_API_KEY` | Backend | Google AI API key for embeddings and analysis |
| `CORS_ORIGINS` | Backend | Comma-separated allowed origins (default: `http://localhost:5173`) |
| `VITE_API_URL` | Frontend (build) | Backend URL |
| `CHROMA_DIR` | Backend (optional) | ChromaDB storage path (default: `data/chroma`) |
| `R2_BUCKET` | Backend (optional) | Cloudflare R2 bucket for policy PDFs |
| `R2_ENDPOINT_URL` | Backend (optional) | R2 endpoint URL |
| `R2_ACCESS_KEY_ID` | Backend (optional) | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Backend (optional) | R2 secret key |
| `R2_PREFIX` | Backend (optional) | R2 key prefix for policy files |
