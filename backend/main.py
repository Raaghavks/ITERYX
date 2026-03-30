import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import redis.asyncio as redis
from dotenv import load_dotenv

from backend.database import engine, Base, get_db
from backend.sockets.events import socket_app
import backend.models # Ensure models are registered

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

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Socket.IO
app.mount("/socket.io", socket_app)

# Helper for standardized responses
def standard_response(success: bool, data: any = None, message: str = ""):
    return {
        "success": success,
        "data": data,
        "message": message
    }

@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
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

# Import and include routers (Placeholders)
# from backend.routes import patient, queue, bed
# app.include_router(patient.router, prefix="/api/patients", tags=["Patients"])
# app.include_router(queue.router, prefix="/api/queue", tags=["Queue"])
# app.include_router(bed.router, prefix="/api/beds", tags=["Beds"])
