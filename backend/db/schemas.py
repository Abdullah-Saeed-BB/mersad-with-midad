"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# AI Write
# ---------------------------------------------------------------------------

class WriteRequest(BaseModel):
    """Payload for the /ai/write endpoint."""

    prompt: str = Field(
        ...,
        min_length=1,
        max_length=10_000,
        description="The user's writing prompt.",
        examples=["Write a short paragraph about the importance of clean code."],
    )
    language: str = Field(
        default="en",
        description="ISO 639-1 language code for the output.",
        examples=["en", "ar"],
    )


# ---------------------------------------------------------------------------
# AI Improve
# ---------------------------------------------------------------------------

class ImproveRequest(BaseModel):
    """Payload for the /ai/improve endpoint."""

    selected_text: str = Field(
        ...,
        min_length=1,
        max_length=50_000,
        description="The text the user has selected and wants to improve.",
    )
    instruction: str = Field(
        ...,
        min_length=1,
        max_length=5_000,
        description="What the user wants done to the selected text (e.g. 'make it more formal').",
        examples=["Make this paragraph shorter and more professional."],
    )
    language: str = Field(
        default="en",
        description="ISO 639-1 language code for the output.",
        examples=["en", "ar"],
    )
