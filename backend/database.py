"""
Shared database and Redis connection helpers.
Every route module imports get_db_connection / get_redis from here.
"""

import os
import json
from contextlib import contextmanager
from pathlib import Path

import psycopg2
import psycopg2.extras
import redis.asyncio as aioredis
from dotenv import load_dotenv

# ── Load .env from project root or backend dir ──────────────────────────
_backend_dir = Path(__file__).resolve().parent
_root_dir = _backend_dir.parent
load_dotenv(_root_dir / ".env")
load_dotenv(_backend_dir / ".env")

DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://admin:admin123@localhost:5432/hospital_db")
REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")


# ── PostgreSQL ──────────────────────────────────────────────────────────

def get_db_connection():
    """Return a new psycopg2 connection with RealDictCursor as default."""
    return psycopg2.connect(
        DATABASE_URL,
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


@contextmanager
def get_db():
    """Context manager that yields a cursor and auto-commits / rolls back."""
    conn = get_db_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                yield cur
    finally:
        conn.close()


# ── Redis (async) ───────────────────────────────────────────────────────

_redis_pool: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """Return a shared async Redis client (lazy-initialised)."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis_pool


async def set_redis_json(key: str, data: dict, ex: int = 3600) -> None:
    """Convenience: store a dict as JSON string in Redis with TTL."""
    r = await get_redis()
    await r.set(key, json.dumps(data), ex=ex)


async def get_redis_json(key: str) -> dict | None:
    """Convenience: retrieve and parse a JSON value from Redis."""
    r = await get_redis()
    raw = await r.get(key)
    if raw is None:
        return None
    return json.loads(raw)
