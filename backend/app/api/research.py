"""
POST /api/research

Streams the research pipeline's progress to the client using
Server-Sent Events. See app/agent/research_agent.py for the actual
pipeline; this module only formats its events as SSE.
"""

import json
import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.agent.research_agent import run_research
from app.schemas.schemas import ResearchRequest

logger = logging.getLogger(__name__)

router = APIRouter()


def _format_sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _event_stream(company_name: str):
    try:
        async for event, data in run_research(company_name):
            yield _format_sse(event, data)
    except Exception:
        # Absolute last-resort safety net: never let an unexpected exception
        # crash the stream or leak a stack trace to the client.
        logger.exception("Unexpected error while streaming research for %r", company_name)
        yield _format_sse(
            "error", {"message": "Unable to research this company right now. Please try again."}
        )


@router.post("/api/research")
async def research(request: ResearchRequest) -> StreamingResponse:
    return StreamingResponse(
        _event_stream(request.company_name),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Disable buffering in case the app is run behind nginx.
            "X-Accel-Buffering": "no",
        },
    )
