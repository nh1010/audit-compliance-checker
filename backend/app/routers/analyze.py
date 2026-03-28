import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import AnalyzeRequest
from app.services.gemini import analyze_all
from app.services.vector_store import search as vector_search

logger = logging.getLogger(__name__)
router = APIRouter()

KEEPALIVE_INTERVAL = 15  # seconds


@router.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    if not req.questions:
        raise HTTPException(status_code=400, detail="No questions provided")

    async def event_stream():
        queue: asyncio.Queue[str | None] = asyncio.Queue()
        done = asyncio.Event()

        async def producer():
            try:
                async for result in analyze_all(req.questions, vector_search):
                    data = json.dumps(result.model_dump())
                    await queue.put(f"data: {data}\n\n")
                await queue.put("data: [DONE]\n\n")
            except Exception as e:
                logger.exception("Analysis error")
                error_data = json.dumps({"error": str(e)})
                await queue.put(f"data: {error_data}\n\n")
                await queue.put("data: [DONE]\n\n")
            finally:
                done.set()
                await queue.put(None)

        asyncio.create_task(producer())

        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_INTERVAL)
                if msg is None:
                    break
                yield msg
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
