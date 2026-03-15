from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_ENV_PATH)


@dataclass(frozen=True)
class Settings:
    database_url: str
    gemini_api_key: str | None
    gemini_model: str
    usda_api_key: str | None
    allowed_origins: list[str]


def get_settings() -> Settings:
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:password@localhost:5432/macro_tracker",
    )
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg2://", 1)
    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    gemini_model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    usda_api_key = os.environ.get("USDA_API_KEY")
    raw_origins = os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:19006,http://localhost:8081",
    )
    allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return Settings(
        database_url=database_url,
        gemini_api_key=gemini_api_key,
        gemini_model=gemini_model,
        usda_api_key=usda_api_key,
        allowed_origins=allowed_origins,
    )
