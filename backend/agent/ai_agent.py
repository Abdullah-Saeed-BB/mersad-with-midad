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
    lines = data.split("\n")
    return "".join(f"data: {line}\n" for line in lines) + "\n"


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
    if language.lower().strip() == "ar":
        mock_response = (
            "هذي جملة منشوئة \n(المفروض) من الذكاء الاصطناعي "
            "الكلام الي قاعد اكتبه مجرد استهبال فكر قبل ما تقرأ "
            "ايش رايك بي طبقة الاوزون,\n الصراحة ما افضلها زي الكبسة "
            "المفروض ما يكون فيه نصوص معمولة بالذكاء الاصطناعي حالياً "
            "تسألني ليش؟\n\nاقلك مدري بس كذا, الزبدة, شكلي بنهي هنا\n "
            "# المقطع الأول\n"
            "## المشهد الأول | في له عدة شخصيات\n"
            "محتوى المشهد الي في له عدة شخصيات"
        )
    else:
        mock_response = (
            f"[Mock Write - language: {language}]\n\n"
            f'Generating content for prompt: "{prompt}"\n\n'
            "# Improved version:\n"
            "## This First\n"
            "Milk\n"
            "## This Second\n"
            "Egg\n"
            "## This Third\n"
            "Wheat\n"
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
        f"[Mock Improve - language: {language}]\n"
        f'Instruction: "{instruction}"\n'
        f"Original ({len(selected_text)} chars): {selected_text[:120]}{'...' if len(selected_text) > 120 else ''}\n\n"
        "Improved version: "
        "jdakjdask jdjksa daksdj kasjd ask "
    )

    for word in mock_response.split(" "):
        yield _sse(word + " ")
        await asyncio.sleep(0.04)

    yield _sse("[DONE]")
