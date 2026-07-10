"""
Application settings loaded from environment variables via Pydantic BaseSettings.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App-wide configuration. Values are read from .env or environment."""

    app_name: str = "Mersad AI Backend"
    debug: bool = False

    # OpenAI / LLM
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
