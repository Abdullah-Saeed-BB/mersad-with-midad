"""
Global dependencies for the FastAPI application.
Use this file to define shared dependencies (DB sessions, auth, config, etc.)
that are injected via FastAPI's Depends() system.
"""

from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@lru_cache
def get_settings():
    """Return application settings. Cached after first call."""
    from db.config import Settings
    return Settings()
