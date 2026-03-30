from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


def _split_csv(value: str | None, default: list[str]) -> list[str]:
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_env: str
    port: int
    database_url: str
    redis_url: str
    cors_allow_origins: list[str]
    log_level: str

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    def validate(self) -> list[str]:
        issues: list[str] = []
        if self.is_production and "*" in self.cors_allow_origins:
            issues.append("Wildcard CORS is not allowed in production.")
        if self.is_production and any("localhost" in origin for origin in self.cors_allow_origins):
            issues.append("Localhost CORS origins should be removed in production.")
        return issues


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        app_env=os.getenv("APP_ENV", "development"),
        port=int(os.getenv("PORT", "8000")),
        database_url=os.getenv("DATABASE_URL", "postgresql://admin:admin123@localhost:5432/hospital_db"),
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
        cors_allow_origins=_split_csv(
            os.getenv("CORS_ALLOW_ORIGINS"),
            ["http://localhost:3000", "http://127.0.0.1:3000"],
        ),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
    )
