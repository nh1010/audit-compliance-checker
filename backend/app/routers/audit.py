from fastapi import APIRouter, HTTPException

from app.models.schemas import ParseRequest, ParseResponse
from app.services.pdf_parser import parse_audit_questions
from app.routers.upload import get_upload_path

router = APIRouter()


@router.post("/api/audit/parse", response_model=ParseResponse)
async def parse_audit(req: ParseRequest):
    path = get_upload_path(req.file_id)

    try:
        questions = parse_audit_questions(path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse audit PDF: {e}")

    if not questions:
        raise HTTPException(status_code=422, detail="No questions could be extracted from the PDF")

    return ParseResponse(questions=questions)
