from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from backend.sockets.events import socket_app
from backend.routes.beds import router as beds_router
from backend.routes.admissions import router as admissions_router

app = FastAPI(title="Hospital System API")

# CORS — allow all origins for development
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

# Mount Socket.IO application
app.mount("/socket.io", socket_app)


@app.get("/")
async def root():
    return {"message": "Welcome to the Hospital System API"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
