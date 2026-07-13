"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List


# ---------------------------------------------------------------------------
# AI Write
# ---------------------------------------------------------------------------

class Reference(BaseModel):
    id: str = Field(..., description="Reference ID.")
    title: str = Field(..., description="Reference title.")
    markdown: str = Field(..., description="Reference markdown content.")

class WriteRequest(BaseModel):
    """Payload for the /ai/write endpoint."""

    prompt: str = Field(
        ...,
        min_length=1,
        max_length=10_000,
        description="The user's writing prompt.",
        examples=["Write a short paragraph about the importance of clean code."],
    )
    context: Optional[str] = Field(
        None,
        description="Context where the prompt is asking for improvement or update.",
    )
    selected_text: Optional[str] = Field(
        None,
        description="The text the user wants to update.",
    )
    references: List[Reference] = Field(
        default_factory=list,
        description="List of reference objects with title and markdown.",
    )
