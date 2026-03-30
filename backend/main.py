from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from time import perf_counter
from uuid import uuid4

import redis.asyncio as redis
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from sqlalchemy import text

from backend.api_contract import (
    http_exception_handler,
    success_response,
    validation_exception_handler,
)
from backend.database import Base, engine, get_db
from backend.logging_config import configure_logging
from backend.monitoring import monitoring_state
from backend.routes.admissions import router as admissions_router
from backend.routes.beds import router as beds_router
from backend.routes.dashboard import router as dashboard_router
from backend.routes.triage import router as triage_router
from backend.routes.triage import router_patients as patients_router
from backend.routes.triage import router_queue as queue_router
from backend.settings import get_settings
from backend.sockets.events import socket_app
import backend.models


load_dotenv()
settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    issues = settings.validate()
    if issues and settings.is_production:
        raise RuntimeError("; ".join(issues))
    if issues:
        logger.warning(
            "startup_configuration_warning",
            extra={"structured_data": {"issues": issues, "app_env": settings.app_env}},
        )

    app.state.redis = None

    if engine is not None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    else:
        logger.warning("async_database_engine_unavailable")

    try:
        app.state.redis = redis.from_url(settings.redis_url, decode_responses=True)
        await app.state.redis.ping()
    except Exception as exc:
        logger.warning(
            "redis_startup_check_failed",
            extra={"structured_data": {"error": str(exc)}},
        )

    yield

    if app.state.redis is not None:
        await app.state.redis.close()


app = FastAPI(title="Hospital System API", lifespan=lifespan)

app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", uuid4().hex[:12])
    started = perf_counter()
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception:
        logger.exception(
            "request_failed",
            extra={
                "structured_data": {
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                }
            },
        )
        raise

    duration_ms = round((perf_counter() - started) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    monitoring_state.record(path=request.url.path, status_code=status_code)
    logger.info(
        "request_completed",
        extra={
            "structured_data": {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "duration_ms": duration_ms,
            }
        },
    )
    return response


app.include_router(beds_router)
app.include_router(admissions_router)
app.include_router(triage_router)
app.include_router(patients_router)
app.include_router(queue_router)
app.include_router(dashboard_router)


@app.get("/api/doctors", tags=["Doctors"])
async def get_all_doctors():
    with get_db() as cur:
        cur.execute(
            """
            SELECT
                id,
                name,
                specialization,
                CASE WHEN is_available THEN 'available' ELSE 'busy' END AS status
            FROM doctors
            ORDER BY name ASC
            """
        )
        rows = cur.fetchall()
        return success_response(
            data=[dict(r) for r in rows],
            message="Doctors retrieved",
        )


app.mount("/socket.io", socket_app)


async def check_db_status() -> str:
    if engine is None:
        return "unavailable"
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        return "connected"
    except Exception:
        return "disconnected"


async def check_redis_status() -> str:
    redis_client = getattr(app.state, "redis", None)
    if redis_client is None:
        return "unavailable"
    try:
        await redis_client.ping()
        return "connected"
    except Exception:
        return "disconnected"


@app.get("/livez")
async def liveness_check():
    return success_response(
        data={"status": "alive", "app_env": settings.app_env},
        message="Liveness check passed",
    )


@app.get("/readyz")
async def readiness_check():
    db_status = await check_db_status()
    redis_status = await check_redis_status()
    ready = db_status == "connected" and redis_status in {"connected", "unavailable"}
    return success_response(
        data={
            "ready": ready,
            "db": db_status,
            "redis": redis_status,
        },
        message="Readiness check completed",
        status_code=200 if ready else 503,
    )


@app.get("/health")
async def health_check():
    db_status = await check_db_status()
    redis_status = await check_redis_status()
    return success_response(
        data={
            "db": db_status,
            "redis": redis_status,
            "app_env": settings.app_env,
            "monitoring": monitoring_state.snapshot(),
        },
        message="System health status",
    )


@app.get("/metrics")
async def metrics():
    snapshot = monitoring_state.snapshot()
    body = "\n".join(
        [
            "# HELP iteryx_requests_total Total HTTP requests handled.",
            "# TYPE iteryx_requests_total counter",
            f"iteryx_requests_total {snapshot['total_requests']}",
            "# HELP iteryx_request_errors_total Total HTTP 5xx requests handled.",
            "# TYPE iteryx_request_errors_total counter",
            f"iteryx_request_errors_total {snapshot['error_requests']}",
            "# HELP iteryx_uptime_seconds Application uptime in seconds.",
            "# TYPE iteryx_uptime_seconds gauge",
            f"iteryx_uptime_seconds {snapshot['uptime_seconds']}",
        ]
    )
    return PlainTextResponse(body)


@app.get("/")
async def root():
    return success_response(message="Welcome to the Hospital System API")
