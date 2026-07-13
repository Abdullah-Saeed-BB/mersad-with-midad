"""
AI router — handles /ai/write and /ai/improve endpoints.

Both endpoints stream their response back to the client using
StreamingResponse + Server-Sent Events (SSE) format.
Incoming data is validated exclusively via Pydantic schemas.
"""

import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from db.schemas import WriteRequest
from agent.ai_agent import stream_write

router = APIRouter()


# ---------------------------------------------------------------------------
# /ai/write
# ---------------------------------------------------------------------------

@router.post("/write", summary="Generate text from a prompt")
async def write(request: WriteRequest):
    """
    Accepts a user prompt and streams back AI-generated text.

    - **prompt**: The writing instruction / topic.
    - **context**: The context where the prompt is asking for improvement or update.
    - **selected_text**: The text the user wants to update.
    - **references**: List of reference objects with title and script.
    """

    print("\n\n==================================\n")
    print("prompt:\t", request.prompt)
    print("context:\t", request.context)
    print("selected_text:\t", request.selected_text)
    print("references:\t", request.references)
    print("\n==================================\n\n")

    
    return StreamingResponse(
        stream_write(prompt=request.prompt, language='en'),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )