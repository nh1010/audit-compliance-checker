import os
import uuid
import tempfile

from fastapi import APIRouter, UploadFile, HTTPException

from app.models.schemas import UploadResponse

router = APIRouter()

UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "audit_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/api/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    file_id = str(uuid.uuid4())
    dest = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    with open(dest, "wb") as f:
        f.write(content)

    return UploadResponse(file_id=file_id, filename=file.filename)


def get_upload_path(file_id: str) -> str:
    path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_id}")
    return path
