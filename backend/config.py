"""
config.py — Environment configuration loader for LecturaMind backend.
Reads all secrets from .env and exposes them as typed attributes.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from urllib.parse import urlparse

# Resolve the backend environment file from this module, not the shell's current
# directory. This keeps `python backend/app.py` and `cd backend; python app.py`
# pointed at the same local Supabase project.
load_dotenv(dotenv_path=Path(__file__).resolve().with_name(".env"))


class Config:
    """Central config object; import and use Config.ATTRIBUTE anywhere."""

    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "changeme")
    FLASK_ENV: str = os.getenv("FLASK_ENV", "development")
    FLASK_PORT: int = int(os.getenv("FLASK_PORT", "5000"))
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    DEV_ACTIVATION_LINKS_ENABLED: bool = os.getenv("DEV_ACTIVATION_LINKS_ENABLED", "").strip().lower() == "true"

    @classmethod
    def is_verified_development_environment(cls) -> bool:
        return os.getenv("FLASK_ENV", "").strip().lower() in {"development", "dev"}

    @classmethod
    def dev_activation_links_enabled(cls) -> bool:
        """Fail closed unless explicitly enabled on a local development origin."""
        frontend_host = (urlparse(cls.FRONTEND_URL).hostname or "").lower()
        return (
            os.getenv("DEV_ACTIVATION_LINKS_ENABLED", "").strip().lower() == "true"
            and cls.is_verified_development_environment()
            and frontend_host in {"localhost", "127.0.0.1", "::1"}
        )

    @classmethod
    def validate(cls) -> None:
        """Raise an error at startup if critical env vars are missing."""
        required = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "ANTHROPIC_API_KEY"]
        missing = [k for k in required if not getattr(cls, k)]
        if missing:
            raise EnvironmentError(
                f"Missing required environment variables: {', '.join(missing)}"
            )
