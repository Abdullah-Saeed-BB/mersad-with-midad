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
from agent.ai_agent import call_agent

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
    print("\ncontext:\t", request.context)
    print("\nselected_text:\t", request.selected_text)
    print("\nreferences:\t")
    for ref in request.references:
        print("\t\t", ref)
    print("\n==================================\n\n")

    response = call_agent(
        prompt=request.prompt,
        context=request.context,
        selected_text=request.selected_text,
        references=request.references,
    )
    
    return StreamingResponse(
        response,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )