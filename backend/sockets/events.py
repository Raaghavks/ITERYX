from socketio import AsyncServer, ASGIApp
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Socket.IO AsyncServer
sio = AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = ASGIApp(sio)

@sio.on("connect")
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")
    await sio.emit("connection_ack", {"message": "Connected to hospital system"}, to=sid)

@sio.on("join_ward")
async def join_ward(sid, data):
    ward_id = data.get("ward_id")
    if ward_id:
        room = f"ward_{ward_id}"
        sio.enter_room(sid, room)
        logger.info(f"Client {sid} joined ward: {ward_id}")
    else:
        logger.warning(f"Client {sid} tried to join ward without ward_id")

@sio.on("disconnect")
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

# Helper functions for use in route files

async def emit_bed_update(ward_id, bed_id, new_status, patient_name=None):
    """
    Emits 'bed_status_update' to room f'ward_{ward_id}' and to all clients
    """
    payload = {
        "bed_id": bed_id,
        "ward_id": ward_id,
        "new_status": new_status,
        "patient_name": patient_name
    }
    # Emit to specific ward room
    await sio.emit("bed_status_update", payload, room=f"ward_{ward_id}")
    # Emit to all connected clients (as requested)
    await sio.emit("bed_status_update", payload)

async def emit_queue_update(queue_data):
    """
    Emits 'queue_update' to all connected clients
    """
    await sio.emit("queue_update", queue_data)

async def emit_emergency_alert(patient_name, priority, score):
    """
    Emits 'emergency_alert' to all connected clients
    """
    from datetime import datetime
    payload = {
        "patient_name": patient_name,
        "priority": priority,
        "score": score,
        "timestamp": datetime.utcnow().isoformat()
    }
    await sio.emit("emergency_alert", payload)
