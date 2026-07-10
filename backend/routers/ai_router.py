"""
AI router — handles /ai/write and /ai/improve endpoints.

Both endpoints stream their response back to the client using
StreamingResponse + Server-Sent Events (SSE) format.
Incoming data is validated exclusively via Pydantic schemas.
"""

import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from db.schemas import WriteRequest, ImproveRequest
from agent.ai_agent import stream_write, stream_improve

router = APIRouter()


# ---------------------------------------------------------------------------
# /ai/write
# ---------------------------------------------------------------------------

@router.post("/write", summary="Generate text from a prompt")
async def write(request: WriteRequest):
    """
    Accepts a user prompt and streams back AI-generated text.

    - **prompt**: The writing instruction / topic.
    - **language**: Target output language (ISO 639-1).
    """
    return StreamingResponse(
        stream_write(prompt=request.prompt, language=request.language),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# /ai/improve
# ---------------------------------------------------------------------------

@router.post("/improve", summary="Improve selected text based on an instruction")
async def improve(request: ImproveRequest):
    """
    Accepts selected text + an improvement instruction and streams back
    the AI-improved version.

    - **selected_text**: The text the user highlighted.
    - **instruction**: What improvement the user wants applied.
    - **language**: Target output language (ISO 639-1).
    """
    return StreamingResponse(
        stream_improve(
            selected_text=request.selected_text,
            instruction=request.instruction,
            language=request.language,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
