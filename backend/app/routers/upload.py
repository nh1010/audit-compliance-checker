import os
import re
import uuid
import tempfile
from pathlib import Path

from fastapi import APIRouter, UploadFile, HTTPException

from app.models.schemas import UploadResponse

router = APIRouter()

UPLOAD_DIR = Path(tempfile.gettempdir()) / "audit_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


@router.post("/api/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    file_id = str(uuid.uuid4())
    dest = UPLOAD_DIR / f"{file_id}.pdf"

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    dest.write_bytes(content)

    return UploadResponse(file_id=file_id, filename=file.filename)


def get_upload_path(file_id: str) -> str:
    if not _UUID_RE.match(file_id):
        raise HTTPException(status_code=400, detail="Invalid file ID")

    path = UPLOAD_DIR / f"{file_id}.pdf"
    resolved = path.resolve()
    if not resolved.is_relative_to(UPLOAD_DIR.resolve()):
        raise HTTPException(status_code=400, detail="Invalid file ID")
    if not resolved.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return str(resolved)
