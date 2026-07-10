"""
AI Agent — streaming generators for the write and improve features.

This module acts as the boundary between the routers and the LLM layer.
Right now both generators produce simulated streaming output so the
rest of the stack (router → StreamingResponse → SSE) can be wired up
and tested without needing API keys.

Swap the body of each generator for real LangChain / LangGraph calls
when you're ready to connect to an LLM.
"""

import asyncio
from typing import AsyncGenerator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sse(data: str) -> str:
    """Format a string as a minimal SSE data event."""
    return f"data: {data}\n\n"


# ---------------------------------------------------------------------------
# Write generator
# ---------------------------------------------------------------------------

async def stream_write(prompt: str, language: str = "en") -> AsyncGenerator[str, None]:
    """
    Yield SSE-formatted chunks that simulate a streamed AI response
    to a user writing prompt.

    Replace the mock lines below with a LangChain / LangGraph streaming
    call, e.g.:

        async for chunk in llm.astream(messages):
            yield _sse(chunk.content)
    """
    mock_response = (
        f"[Mock Write - language: {language}]\n\n"
        f'Generating content for prompt: "{prompt}"\n\n'
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. "
        "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. "
        "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris."
    )

    for word in mock_response.split(" "):
        yield _sse(word + " ")
        await asyncio.sleep(0.04)   # simulate token-by-token streaming

    yield _sse("[DONE]")


# ---------------------------------------------------------------------------
# Improve generator
# ---------------------------------------------------------------------------

async def stream_improve(
    selected_text: str,
    instruction: str,
    language: str = "en",
) -> AsyncGenerator[str, None]:
    """
    Yield SSE-formatted chunks that simulate a streamed AI response
    that improves the selected text according to the user's instruction.

    Replace the mock lines below with a LangChain / LangGraph streaming
    call when ready.
    """
    mock_response = (
        f"[Mock Improve - language: {language}]\n\n"
        f'Instruction: "{instruction}"\n\n'
        f"Original ({len(selected_text)} chars): {selected_text[:120]}{'...' if len(selected_text) > 120 else ''}\n\n"
        "Improved version: "
        "This is a refined, polished version of the selected text. "
        "It is clearer, more concise, and tailored to the requested style."
    )

    for word in mock_response.split(" "):
        yield _sse(word + " ")
        await asyncio.sleep(0.04)

    yield _sse("[DONE]")
