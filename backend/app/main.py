import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import upload, audit, analyze

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _ensure_policies_ingested() -> None:
    """Run policy ingestion for any new/missing PDFs."""
    from scripts.ingest_policies import main as ingest_main
    ingest_main()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ensure_policies_ingested()
    yield


app = FastAPI(title="Audit Compliance Checker API", lifespan=lifespan)

allowed_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(audit.router)
app.include_router(analyze.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
