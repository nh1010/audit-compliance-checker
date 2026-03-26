import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import upload, audit, analyze

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Audit Compliance Checker API")

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
