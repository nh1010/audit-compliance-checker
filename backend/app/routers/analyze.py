import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import AnalyzeRequest
from app.services.pdf_parser import extract_text, parse_policy_metadata
from app.services.gemini import analyze_all
from app.routers.upload import get_upload_path

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    if not req.questions:
        raise HTTPException(status_code=400, detail="No questions provided")
    if not req.policy_file_ids:
        raise HTTPException(status_code=400, detail="No policy files provided")

    policy_texts: dict[str, str] = {}
    for fid in req.policy_file_ids:
        path = get_upload_path(fid)
        meta = parse_policy_metadata(path)
        label = meta.get("policy_id") or fid
        text = extract_text(path)
        policy_texts[label] = text

    async def event_stream():
        try:
            async for result in analyze_all(req.questions, policy_texts):
                data = json.dumps(result.model_dump())
                yield f"data: {data}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.exception("Analysis error")
            error_data = json.dumps({"error": str(e)})
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
