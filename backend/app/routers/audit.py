import asyncio
import json
import logging
from queue import Queue, Empty

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models.schemas import ParseRequest
from app.services.requirement_extractor import stream_requirements
from app.routers.upload import get_upload_path

logger = logging.getLogger(__name__)
router = APIRouter()

_SENTINEL = object()


def _run_generator_to_queue(pdf_path: str, q: Queue) -> None:
    """Run the blocking generator in a thread, pushing events into a queue."""
    try:
        for event in stream_requirements(pdf_path):
            q.put(event)
    except Exception as e:
        q.put({"type": "error", "message": str(e)})
    finally:
        q.put(_SENTINEL)


@router.post("/api/audit/parse")
async def parse_audit(req: ParseRequest):
    path = get_upload_path(req.file_id)

    q: Queue = Queue()
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _run_generator_to_queue, path, q)

    async def event_stream():
        while True:
            try:
                item = q.get_nowait()
            except Empty:
                await asyncio.sleep(0.1)
                continue

            if item is _SENTINEL:
                yield "data: [DONE]\n\n"
                break

            if isinstance(item, dict) and item.get("type") == "error":
                yield f"data: {json.dumps(item)}\n\n"
                yield "data: [DONE]\n\n"
                break

            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
