# Audit Compliance Checker

A web application that automates healthcare regulatory compliance auditing. Upload an audit questionnaire PDF and the app analyzes each requirement against pre-indexed policy documents using AI.

## How It Works

1. **Upload** your audit questions PDF (e.g., a DHCS Submission Review Form)
2. **Analyze** — the app retrieves relevant policy excerpts via vector search and checks each question using Google Gemini
3. **Review** results with compliance status, evidence citations, and confidence scores

## Tech Stack

- **Frontend**: React 19 + TypeScript, Vite, Tailwind CSS v4, React Router, Lucide icons
- **Backend**: Python 3.12, FastAPI, pdfplumber, Pydantic v2
- **Vector DB**: ChromaDB (embedded, baked into Docker image)
- **Embeddings**: Google `gemini-embedding-001`
- **AI**: Google Gemini 2.5 Flash (via `google-genai` SDK)
- **Hosting**: Vercel (frontend) + Render (backend, free tier)

## Architecture

```
frontend/          React SPA (Vite) — hosted on Vercel
├── src/
│   ├── pages/     Home (upload + analyze), Results
│   ├── components/  FileUpload, ProgressBar, ResultRow, SummaryCards, StatusBadge
│   └── lib/       API client, shared types

backend/           FastAPI service (Docker) — hosted on Render
├── app/
│   ├── routers/   upload, audit (parse questions), analyze (SSE streaming)
│   ├── services/  gemini (AI analysis), pdf_parser, vector_store (ChromaDB)
│   └── models/    Pydantic schemas
├── scripts/       ingest_policies.py (CLI indexer, runs at Docker build time)
├── policies/      Policy PDFs (gitignored, local only)
└── data/chroma/   ChromaDB index (built at Docker build time, gitignored)
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
# Source the env so Docker can access GEMINI_API_KEY as a build secret
source backend/.env && docker compose up --build
```

This builds a multi-stage Docker image that:
1. Reads all PDFs from `backend/policies/`
2. Chunks and embeds them using Google's embedding model
3. Stores the ChromaDB index inside the image
4. Starts the FastAPI server on `http://localhost:8000`

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

Add or replace PDFs in `backend/policies/`, then rebuild:

```bash
docker compose up --build
```

## Deployment

### Backend (Render)

1. Push to GitHub (policy PDFs are gitignored)
2. On [Render](https://render.com), create a new **Web Service** from the repo
3. Set the **Docker context** to `backend/` and **Dockerfile path** to `backend/Dockerfile`
4. Add environment variables:
   - `GEMINI_API_KEY` — your Google AI API key (also set as a build-time variable)
   - `CORS_ORIGINS` — your Vercel frontend URL (e.g., `https://your-app.vercel.app`)
5. Select the **Free** instance type
6. Render builds the image (including ingestion) and deploys it

The free tier spins down after 15 min of inactivity. First request after idle takes ~30s to cold start.

### Frontend (Vercel)

1. Import the repo on [Vercel](https://vercel.com)
2. Set the **Root Directory** to `frontend/`
3. Add the environment variable:
   - `VITE_API_URL` — your Render backend URL (e.g., `https://audit-compliance-backend.onrender.com`)
4. Deploy

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `GEMINI_API_KEY` | Backend (runtime + build) | Google AI API key for embeddings and analysis |
| `CORS_ORIGINS` | Backend (runtime) | Comma-separated allowed origins (default: `http://localhost:5173`) |
| `VITE_API_URL` | Frontend (build) | Backend URL (e.g., `https://audit-compliance-backend.onrender.com`) |
