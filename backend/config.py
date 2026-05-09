"""
config.py — Environment configuration loader for LecturaMind backend.
Reads all secrets from .env and exposes them as typed attributes.
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Central config object; import and use Config.ATTRIBUTE anywhere."""

    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "changeme")
    FLASK_ENV: str = os.getenv("FLASK_ENV", "development")
    FLASK_PORT: int = int(os.getenv("FLASK_PORT", "5000"))
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    @classmethod
    def validate(cls) -> None:
        """Raise an error at startup if critical env vars are missing."""
        required = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "OPENAI_API_KEY"]
        missing = [k for k in required if not getattr(cls, k)]
        if missing:
            raise EnvironmentError(
                f"Missing required environment variables: {', '.join(missing)}"
            )
