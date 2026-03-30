from fastapi import FastAPI
from backend.sockets.events import socket_app
import uvicorn

app = FastAPI(title="Hospital System API")

# Mount Socket.IO application
app.mount("/socket.io", socket_app)

@app.get("/")
async def root():
    return {"message": "Welcome to the Hospital System API"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
