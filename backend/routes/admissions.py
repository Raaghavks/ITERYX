"""
Admission & Discharge-order routes.

Endpoints
─────────
POST   /api/admissions               Create an admission record
POST   /api/discharge-orders         Create a discharge order
GET    /api/discharge-orders/pending  List pending (unconfirmed) discharge orders
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.api_contract import success_response
from backend.database import get_db, set_redis_json
from backend.sockets.events import emit_bed_update, emit_discharge_order_update

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["admissions"])


# ── Pydantic request schemas ────────────────────────────────────────────

class AdmissionCreate(BaseModel):
    patient_id: int
    bed_id: int
    doctor_id: int


class DischargeOrderCreate(BaseModel):
    patient_id: int
    bed_id: int
    doctor_id: int
    expected_discharge_at: str  # ISO-8601 datetime string


class DischargeConfirm(BaseModel):
    confirmed_by: int | None = None


# ── POST /api/admissions ────────────────────────────────────────────────

@router.post("/admissions")
async def create_admission(body: AdmissionCreate):
    """
    1. Create admission record in DB
    2. Update bed status → 'occupied', set assigned_patient_id
    3. Update opd_queue status → 'completed' for this patient
    4. Emit bed_status_update via Socket.IO
    5. Return admission record
    """
    with get_db() as cur:
        # Verify the bed exists
        cur.execute("SELECT id, ward_id, bed_number, status FROM beds WHERE id = %s", (body.bed_id,))
        bed = cur.fetchone()
        if not bed:
            raise HTTPException(status_code=404, detail=f"Bed {body.bed_id} not found")
        if bed["status"] == "OCCUPIED":
            raise HTTPException(status_code=409, detail="Bed is already occupied")

        # Verify the patient exists
        cur.execute("SELECT id, name FROM patients WHERE id = %s", (body.patient_id,))
        patient = cur.fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail=f"Patient {body.patient_id} not found")

        # Verify the doctor exists
        cur.execute("SELECT id, name FROM doctors WHERE id = %s", (body.doctor_id,))
        doctor = cur.fetchone()
        if not doctor:
            raise HTTPException(status_code=404, detail=f"Doctor {body.doctor_id} not found")

        # 1. Create admission record
        cur.execute(
            """
            INSERT INTO admissions (patient_id, bed_id, doctor_id, admitted_at)
            VALUES (%s, %s, %s, %s)
            RETURNING id, patient_id, bed_id, doctor_id, admitted_at;
            """,
            (body.patient_id, body.bed_id, body.doctor_id, datetime.now(timezone.utc)),
        )
        admission = cur.fetchone()

        # 2. Update bed status → occupied
        cur.execute(
            """
            UPDATE beds
            SET status = 'OCCUPIED', assigned_patient_id = %s
            WHERE id = %s;
            """,
            (body.patient_id, body.bed_id),
        )

        # 3. Mark opd_queue entry as completed
        cur.execute(
            """
            UPDATE opd_queue
            SET status = 'COMPLETED'
            WHERE patient_id = %s AND status != 'COMPLETED';
            """,
            (body.patient_id,),
        )

    # Update Redis cache
    redis_payload = {
        "bed_id": bed["id"],
        "ward_id": bed["ward_id"],
        "bed_number": bed["bed_number"],
        "status": "occupied",
        "assigned_patient_id": body.patient_id,
        "patient_name": patient["name"],
    }
    await set_redis_json(f"bed:{body.bed_id}", redis_payload)

    # 4. Emit Socket.IO event
    await emit_bed_update(
        ward_id=bed["ward_id"],
        bed_id=bed["id"],
        new_status="occupied",
        patient_name=patient["name"],
    )

    return success_response(
        data={
            "admission_id": admission["id"],
            "patient_id": admission["patient_id"],
            "patient_name": patient["name"],
            "bed_id": admission["bed_id"],
            "bed_number": bed["bed_number"],
            "ward_id": bed["ward_id"],
            "doctor_id": admission["doctor_id"],
            "doctor_name": doctor["name"],
            "admitted_at": admission["admitted_at"].isoformat(),
            "status": "admitted",
        },
        message="Patient admitted successfully",
        status_code=201,
    )


# ── POST /api/discharge-orders ──────────────────────────────────────────

@router.post("/discharge-orders")
async def create_discharge_order(body: DischargeOrderCreate):
    """Create a discharge order record in DB."""
    with get_db() as cur:
        # Validate patient
        cur.execute("SELECT id FROM patients WHERE id = %s", (body.patient_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"Patient {body.patient_id} not found")

        # Validate doctor
        cur.execute("SELECT id FROM doctors WHERE id = %s", (body.doctor_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"Doctor {body.doctor_id} not found")

        # Validate bed
        cur.execute("SELECT id, assigned_patient_id FROM beds WHERE id = %s", (body.bed_id,))
        bed = cur.fetchone()
        if not bed:
            raise HTTPException(status_code=404, detail=f"Bed {body.bed_id} not found")
        if bed["assigned_patient_id"] != body.patient_id:
            raise HTTPException(status_code=409, detail="Bed is not assigned to the selected patient")

        # Validate active admission
        cur.execute(
            """
            SELECT id
            FROM admissions
            WHERE patient_id = %s AND bed_id = %s AND discharged_at IS NULL
            ORDER BY admitted_at DESC
            LIMIT 1
            """,
            (body.patient_id, body.bed_id),
        )
        admission = cur.fetchone()
        if not admission:
            raise HTTPException(status_code=404, detail="Active admission not found for patient and bed")

        # Prevent duplicate pending discharge orders
        cur.execute(
            """
            SELECT id
            FROM discharge_orders
            WHERE patient_id = %s AND bed_id = %s AND confirmed_at IS NULL
            LIMIT 1
            """,
            (body.patient_id, body.bed_id),
        )
        existing_order = cur.fetchone()
        if existing_order:
            raise HTTPException(status_code=409, detail="A pending discharge order already exists for this patient")

        # Parse the expected discharge time
        try:
            expected_dt = datetime.fromisoformat(body.expected_discharge_at)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="expected_discharge_at must be a valid ISO-8601 datetime string",
            )

        cur.execute(
            """
            INSERT INTO discharge_orders (patient_id, bed_id, doctor_id, expected_discharge_at)
            VALUES (%s, %s, %s, %s)
            RETURNING id, patient_id, bed_id, doctor_id, expected_discharge_at, confirmed_at;
            """,
            (body.patient_id, body.bed_id, body.doctor_id, expected_dt),
        )
        order = cur.fetchone()

    await emit_discharge_order_update(
        event="created",
        order_id=order["id"],
        patient_id=order["patient_id"],
        bed_id=order["bed_id"],
    )

    return success_response(
        data={
            "discharge_order_id": order["id"],
            "patient_id": order["patient_id"],
            "bed_id": order["bed_id"],
            "doctor_id": order["doctor_id"],
            "expected_discharge_at": order["expected_discharge_at"].isoformat(),
            "confirmed_at": order["confirmed_at"].isoformat() if order["confirmed_at"] else None,
        },
        message="Discharge order created",
        status_code=201,
    )


@router.patch("/discharge-orders/{order_id}/confirm")
async def confirm_discharge_order(order_id: int, body: DischargeConfirm):
    confirmed_at = datetime.now(timezone.utc)

    with get_db() as cur:
        cur.execute(
            """
            SELECT id, patient_id, bed_id, doctor_id, expected_discharge_at, confirmed_at
            FROM discharge_orders
            WHERE id = %s
            """,
            (order_id,),
        )
        order = cur.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Discharge order not found")
        if order["confirmed_at"] is not None:
            raise HTTPException(status_code=409, detail="Discharge order already confirmed")

        cur.execute("SELECT id, name FROM patients WHERE id = %s", (order["patient_id"],))
        patient = cur.fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        cur.execute("SELECT id, ward_id, bed_number FROM beds WHERE id = %s", (order["bed_id"],))
        bed = cur.fetchone()
        if not bed:
            raise HTTPException(status_code=404, detail="Bed not found")

        cur.execute(
            """
            UPDATE discharge_orders
            SET confirmed_at = %s
            WHERE id = %s
            """,
            (confirmed_at, order_id),
        )

        cur.execute(
            """
            UPDATE admissions
            SET discharged_at = %s
            WHERE patient_id = %s AND bed_id = %s AND discharged_at IS NULL
            """,
            (confirmed_at, order["patient_id"], order["bed_id"]),
        )

        cur.execute(
            """
            UPDATE beds
            SET status = 'AVAILABLE', assigned_patient_id = NULL
            WHERE id = %s
            """,
            (order["bed_id"],),
        )

    redis_payload = {
        "bed_id": bed["id"],
        "ward_id": bed["ward_id"],
        "bed_number": bed["bed_number"],
        "status": "available",
        "assigned_patient_id": None,
        "patient_name": None,
    }
    await set_redis_json(f"bed:{order['bed_id']}", redis_payload)

    await emit_bed_update(
        ward_id=bed["ward_id"],
        bed_id=bed["id"],
        new_status="available",
        patient_name=None,
    )
    await emit_discharge_order_update(
        event="confirmed",
        order_id=order_id,
        patient_id=order["patient_id"],
        bed_id=order["bed_id"],
    )

    return success_response(
        data={
            "discharge_order_id": order_id,
            "patient_id": order["patient_id"],
            "patient_name": patient["name"],
            "bed_id": order["bed_id"],
            "bed_number": bed["bed_number"],
            "confirmed_at": confirmed_at.isoformat(),
            "status": "completed",
            "confirmed_by": body.confirmed_by,
        },
        message="Discharge completed and bed released",
    )


# ── GET /api/discharge-orders/pending ───────────────────────────────────

@router.get("/discharge-orders/pending")
async def get_pending_discharge_orders():
    """
    Return all discharge orders where confirmed_at IS NULL.
    Includes patient name, bed number, ward name.
    Sorted by expected_discharge_at ASC.
    """
    with get_db() as cur:
        cur.execute(
            """
            SELECT
                d.id                       AS order_id,
                d.patient_id,
                p.name                     AS patient_name,
                b.id                       AS bed_id,
                b.bed_number,
                w.name                     AS ward_name,
                d.expected_discharge_at,
                d.doctor_id
            FROM discharge_orders d
            JOIN patients p ON p.id = d.patient_id
            LEFT JOIN beds b ON b.id = d.bed_id
            LEFT JOIN wards w ON w.id = b.ward_id
            WHERE d.confirmed_at IS NULL
            ORDER BY d.expected_discharge_at ASC;
            """
        )
        rows = cur.fetchall()

    # RealDictRow → plain dicts & serialise datetimes
    result = []
    for row in rows:
        entry = dict(row)
        if entry.get("expected_discharge_at"):
            entry["expected_discharge_at"] = entry["expected_discharge_at"].isoformat()
        result.append(entry)

    return success_response(
        data=result,
        message="Pending discharge orders retrieved",
    )
