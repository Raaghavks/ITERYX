"""
Bed & Ward management routes.

Endpoints
─────────
GET    /api/beds                    All beds grouped by ward
GET    /api/wards                   Ward summary with occupancy stats
PATCH  /api/beds/{bed_id}/status    Update bed status
POST   /api/beds/pre-allocate       Auto-assign a bed for a patient
GET    /api/beds/predict-vacancy    ML-based vacancy prediction per ward
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from backend.database import get_db, set_redis_json
from backend.sockets.events import emit_bed_update

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["beds"])

VALID_BED_STATUSES = {"available", "occupied", "reserved", "maintenance"}


# ── Pydantic request schemas ────────────────────────────────────────────

class BedStatusUpdate(BaseModel):
    status: str
    patient_id: Optional[int] = None


class PreAllocateRequest(BaseModel):
    patient_id: int
    ward_id: Optional[int] = None


# ── GET /api/beds ───────────────────────────────────────────────────────

@router.get("/beds")
async def get_all_beds():
    """Return all beds joined with ward name and assigned patient name, grouped by ward."""
    with get_db() as cur:
        cur.execute(
            """
            SELECT
                b.id        AS bed_id,
                b.bed_number,
                b.status,
                b.ward_id,
                w.name      AS ward_name,
                b.assigned_patient_id,
                p.name      AS patient_name
            FROM beds b
            JOIN wards w ON w.id = b.ward_id
            LEFT JOIN patients p ON p.id = b.assigned_patient_id
            ORDER BY w.id, b.bed_number;
            """
        )
        rows = cur.fetchall()

    # Group by ward
    wards_map: dict[int, dict] = {}
    for row in rows:
        wid = row["ward_id"]
        if wid not in wards_map:
            wards_map[wid] = {
                "ward_id": wid,
                "ward_name": row["ward_name"],
                "beds": [],
            }
        wards_map[wid]["beds"].append(
            {
                "bed_id": row["bed_id"],
                "bed_number": row["bed_number"],
                "status": row["status"],
                "assigned_patient_id": row["assigned_patient_id"],
                "patient_name": row["patient_name"],
            }
        )

    return {"wards": list(wards_map.values())}


# ── GET /api/wards ──────────────────────────────────────────────────────

@router.get("/wards")
async def get_wards_summary():
    """Per-ward summary with counts for each status and occupancy rate."""
    with get_db() as cur:
        cur.execute(
            """
            SELECT
                w.id                                          AS id,
                w.name                                        AS name,
                w.location                                    AS floor,
                w.bed_count                                   AS total_beds,
                COUNT(*) FILTER (WHERE b.status = 'available')    AS available_count,
                COUNT(*) FILTER (WHERE b.status = 'occupied')     AS occupied_count,
                COUNT(*) FILTER (WHERE b.status = 'reserved')     AS reserved_count,
                COUNT(*) FILTER (WHERE b.status = 'maintenance')  AS maintenance_count
            FROM wards w
            LEFT JOIN beds b ON b.ward_id = w.id
            GROUP BY w.id
            ORDER BY w.id;
            """
        )
        rows = cur.fetchall()

    result = []
    for r in rows:
        total = r["total_beds"] or 1
        occupied = r["occupied_count"] or 0
        occupancy_rate = round((occupied / total) * 100, 1)
        result.append(
            {
                "id": r["id"],
                "name": r["name"],
                "floor": r["floor"],
                "total_beds": r["total_beds"],
                "available_count": r["available_count"],
                "occupied_count": r["occupied_count"],
                "reserved_count": r["reserved_count"],
                "maintenance_count": r["maintenance_count"],
                "occupancy_rate": occupancy_rate,
            }
        )

    return result


# ── PATCH /api/beds/{bed_id}/status ─────────────────────────────────────

@router.patch("/beds/{bed_id}/status")
async def update_bed_status(bed_id: int, body: BedStatusUpdate):
    """
    Update bed status in PostgreSQL, cache in Redis, and notify via Socket.IO.
    """
    if body.status not in VALID_BED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{body.status}'. Must be one of: {', '.join(sorted(VALID_BED_STATUSES))}",
        )

    with get_db() as cur:
        # Update bed
        cur.execute(
            """
            UPDATE beds
            SET status = %s,
                assigned_patient_id = %s
            WHERE id = %s
            RETURNING id, ward_id, bed_number, status, assigned_patient_id;
            """,
            (body.status, body.patient_id, bed_id),
        )
        updated = cur.fetchone()

        if not updated:
            raise HTTPException(status_code=404, detail=f"Bed {bed_id} not found")

        # Fetch patient name for the socket payload
        patient_name = None
        if updated["assigned_patient_id"]:
            cur.execute("SELECT name FROM patients WHERE id = %s", (updated["assigned_patient_id"],))
            patient_row = cur.fetchone()
            if patient_row:
                patient_name = patient_row["name"]

    # Cache in Redis
    redis_payload = {
        "bed_id": updated["id"],
        "ward_id": updated["ward_id"],
        "bed_number": updated["bed_number"],
        "status": updated["status"],
        "assigned_patient_id": updated["assigned_patient_id"],
        "patient_name": patient_name,
    }
    await set_redis_json(f"bed:{bed_id}", redis_payload)

    # Emit Socket.IO event
    await emit_bed_update(
        ward_id=updated["ward_id"],
        bed_id=updated["id"],
        new_status=updated["status"],
        patient_name=patient_name,
    )

    return updated


# ── POST /api/beds/pre-allocate ─────────────────────────────────────────

@router.post("/beds/pre-allocate")
async def pre_allocate_bed(body: PreAllocateRequest):
    """
    Find the first available bed (optionally in a preferred ward) and
    reserve it for the given patient.
    """
    with get_db() as cur:
        if body.ward_id:
            # Preferred ward
            cur.execute(
                """
                SELECT b.id AS bed_id, b.bed_number, b.ward_id, w.name AS ward_name
                FROM beds b
                JOIN wards w ON w.id = b.ward_id
                WHERE b.status = 'available' AND b.ward_id = %s
                ORDER BY b.bed_number
                LIMIT 1
                FOR UPDATE SKIP LOCKED;
                """,
                (body.ward_id,),
            )
        else:
            # Any ward — prioritise non-ICU for non-critical patients
            cur.execute(
                """
                SELECT b.id AS bed_id, b.bed_number, b.ward_id, w.name AS ward_name
                FROM beds b
                JOIN wards w ON w.id = b.ward_id
                WHERE b.status = 'available'
                ORDER BY
                    CASE WHEN LOWER(w.name) LIKE '%%icu%%' THEN 1 ELSE 0 END,
                    b.bed_number
                LIMIT 1
                FOR UPDATE SKIP LOCKED;
                """
            )

        bed = cur.fetchone()
        if not bed:
            raise HTTPException(status_code=404, detail="No available bed found")

        # Reserve the bed
        cur.execute(
            """
            UPDATE beds
            SET status = 'reserved', assigned_patient_id = %s
            WHERE id = %s
            RETURNING id, bed_number, ward_id;
            """,
            (body.patient_id, bed["bed_id"]),
        )
        reserved = cur.fetchone()

        # Fetch patient name
        cur.execute("SELECT name FROM patients WHERE id = %s", (body.patient_id,))
        patient_row = cur.fetchone()
        patient_name = patient_row["name"] if patient_row else None

    # Update Redis
    redis_payload = {
        "bed_id": reserved["id"],
        "ward_id": reserved["ward_id"],
        "bed_number": reserved["bed_number"],
        "status": "reserved",
        "assigned_patient_id": body.patient_id,
        "patient_name": patient_name,
    }
    await set_redis_json(f"bed:{reserved['id']}", redis_payload)

    # Emit socket event
    await emit_bed_update(
        ward_id=reserved["ward_id"],
        bed_id=reserved["id"],
        new_status="reserved",
        patient_name=patient_name,
    )

    return {
        "bed_id": bed["bed_id"],
        "bed_number": bed["bed_number"],
        "ward_name": bed["ward_name"],
        "ward_id": bed["ward_id"],
    }


# ── GET /api/beds/predict-vacancy ───────────────────────────────────────

@router.get("/beds/predict-vacancy")
async def predict_vacancy():
    """
    Load bed_predictor.pkl and predict free beds per ward based on
    current occupancy, day-of-week, hour, pending discharges, and a
    historical average discharge rate.
    """
    MODEL_PATH = Path(__file__).resolve().parent.parent / "bed_predictor.pkl"

    # Try loading the ML model; fall back to heuristic if missing
    model = None
    try:
        import joblib
        if MODEL_PATH.exists():
            model = joblib.load(MODEL_PATH)
    except ImportError:
        logger.warning("joblib not installed — using heuristic prediction")
    except Exception as exc:
        logger.warning(f"Could not load bed_predictor.pkl: {exc}")

    now = datetime.now(timezone.utc)
    day_of_week = now.weekday()
    hour_of_day = now.hour
    historical_avg_discharge_rate = 2.5

    with get_db() as cur:
        # Ward occupancy
        cur.execute(
            """
            SELECT
                w.id                                        AS ward_id,
                w.name                                      AS ward_name,
                w.bed_count                                 AS total_beds,
                COUNT(*) FILTER (WHERE b.status = 'available')   AS current_available,
                COUNT(*) FILTER (WHERE b.status = 'occupied')    AS occupied_count
            FROM wards w
            LEFT JOIN beds b ON b.ward_id = w.id
            GROUP BY w.id
            ORDER BY w.id;
            """
        )
        wards = cur.fetchall()

        # Pending discharge count per ward
        cur.execute(
            """
            SELECT b.ward_id, COUNT(*) AS cnt
            FROM discharge_orders d
            JOIN beds b ON b.assigned_patient_id = d.patient_id
            WHERE d.confirmed_at IS NULL
            GROUP BY b.ward_id;
            """
        )
        pending_map = {row["ward_id"]: row["cnt"] for row in cur.fetchall()}

    predictions = []
    for w in wards:
        total = w["total_beds"] or 1
        occupied = w["occupied_count"] or 0
        current_occupancy_rate = round(occupied / total, 4)
        pending_discharge_count = pending_map.get(w["ward_id"], 0)

        if model is not None:
            import numpy as np
            features = np.array(
                [[day_of_week, hour_of_day, current_occupancy_rate,
                  pending_discharge_count, historical_avg_discharge_rate]]
            )
            predicted_free = max(0, int(model.predict(features)[0]))
        else:
            # Simple heuristic: current available + expected discharges
            predicted_free = w["current_available"] + pending_discharge_count

        predictions.append(
            {
                "ward_id": w["ward_id"],
                "ward_name": w["ward_name"],
                "predicted_free_beds": predicted_free,
                "current_available": w["current_available"],
            }
        )

    return predictions
