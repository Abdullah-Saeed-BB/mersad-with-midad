"""
Main FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import ai_router

app = FastAPI(
    title="Mersad AI Backend",
    description="FastAPI backend powering Mersad's AI writing and improvement features.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — allow the frontend dev server; tighten in production
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(ai_router.router, prefix="/ai", tags=["AI"])


@app.get("/", tags=["Health"])
async def root():
    """Health-check endpoint."""
    return {"status": "ok", "message": "Mersad API is running 🚀"}
