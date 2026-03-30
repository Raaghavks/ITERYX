import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis
from dotenv import load_dotenv

from backend.database import Base, engine, get_async_db, get_db
from backend.routes.admissions import router as admissions_router
from backend.routes.beds import router as beds_router
from backend.routes.triage import router as triage_router
from backend.routes.triage import router_patients as patients_router
from backend.routes.triage import router_queue as queue_router
from backend.routes.dashboard import router as dashboard_router
from backend.sockets.events import socket_app
import backend.models

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Startup: Initialize Redis
    app.state.redis = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"), decode_responses=True)
    
    yield
    
    # Shutdown: Close Redis
    await app.state.redis.close()

app = FastAPI(
    title="Hospital System API",
    lifespan=lifespan
)

# CORS - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(beds_router)
app.include_router(admissions_router)
app.include_router(triage_router)
app.include_router(patients_router)
app.include_router(queue_router)
app.include_router(dashboard_router)

# Extra: Inline Doctor listing for registration
@app.get("/api/doctors", tags=["Doctors"])
async def get_all_doctors(db=Depends(get_async_db)):
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
        return [dict(r) for r in rows]

# Mount Socket.IO
app.mount("/socket.io", socket_app)

# Helper for standardized responses
def standard_response(success: bool, data: Any = None, message: str = ""):
    return {
        "success": success,
        "data": data,
        "message": message
    }

@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_async_db)):
    db_status = "connected"
    redis_status = "connected"
    
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"
        
    try:
        await app.state.redis.ping()
    except Exception:
        redis_status = "disconnected"
        
    return standard_response(
        success=(db_status == "connected" and redis_status == "connected"),
        data={"db": db_status, "redis": redis_status},
        message="System health status"
    )

@app.get("/")
async def root():
    return standard_response(True, message="Welcome to the Hospital System API")
