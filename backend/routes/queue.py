from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.models.queue import OPDQueue, Doctor
from backend.models.patient import Patient, TriageScore
from backend.models.bed import Bed, Ward
from backend.sockets.events import emit_queue_update, emit_emergency_alert

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────


class QueueStatusUpdate(BaseModel):
    status: str


# ─── KPI Endpoint ────────────────────────────────────────────────────────────


@router.get("/kpis")
async def get_dashboard_kpis(db: AsyncSession = Depends(get_db)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Total patients registered today
    total_today_result = await db.execute(
        select(func.count(Patient.id)).where(Patient.registered_at >= today_start)
    )
    total_today = total_today_result.scalar() or 0

    # Current queue (waiting)
    queue_result = await db.execute(
        select(func.count(OPDQueue.id)).where(OPDQueue.status == "waiting")
    )
    queue_length = queue_result.scalar() or 0

    # Total patients today via queue (as created_at)
    queue_today_result = await db.execute(
        select(func.count(OPDQueue.id)).where(OPDQueue.created_at >= today_start)
    )
    queue_today = queue_today_result.scalar() or 0

    # Overall bed occupancy
    total_beds_result = await db.execute(select(func.count(Bed.id)))
    total_beds = total_beds_result.scalar() or 1
    occupied_beds_result = await db.execute(
        select(func.count(Bed.id)).where(Bed.status == "occupied")
    )
    occupied_beds = occupied_beds_result.scalar() or 0
    occupancy_pct = round((occupied_beds / total_beds) * 100, 1) if total_beds > 0 else 0

    # Critical patients: triage_scores with priority_level = CRITICAL, joined to waiting queue
    critical_result = await db.execute(
        select(func.count(TriageScore.id))
        .join(OPDQueue, OPDQueue.patient_id == TriageScore.patient_id)
        .where(TriageScore.priority_level.ilike("critical"))
        .where(OPDQueue.status == "waiting")
    )
    critical_patients = critical_result.scalar() or 0

    return {
        "success": True,
        "data": {
            "totalPatientsToday": max(total_today, queue_today),
            "currentQueueLength": queue_length,
            "overallBedOccupancy": occupancy_pct,
            "criticalPatients": critical_patients,
        }
    }


# ─── Queue Endpoints ─────────────────────────────────────────────────────────


@router.get("")
async def get_queue(
    status: Optional[str] = None,
    doctor_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(OPDQueue).order_by(OPDQueue.queue_position.asc().nullsfirst(), OPDQueue.created_at.asc())

    if status:
        query = query.where(OPDQueue.status == status)
    if doctor_id:
        query = query.where(OPDQueue.doctor_id == doctor_id)

    result = await db.execute(query)
    entries = result.scalars().all()

    response = []
    for entry in entries:
        patient_result = await db.execute(select(Patient).where(Patient.id == entry.patient_id))
        patient = patient_result.scalar_one_or_none()

        doctor_result = await db.execute(select(Doctor).where(Doctor.id == entry.doctor_id))
        doctor = doctor_result.scalar_one_or_none()

        # Latest triage score
        triage_result = await db.execute(
            select(TriageScore)
            .where(TriageScore.patient_id == entry.patient_id)
            .order_by(TriageScore.computed_at.desc())
        )
        triage = triage_result.scalar_one_or_none()

        response.append({
            "id": entry.id,
            "queue_position": entry.queue_position,
            "status": entry.status,
            "created_at": entry.created_at.isoformat(),
            "patient": {
                "id": patient.id,
                "name": patient.name,
                "age": patient.age,
                "gender": patient.gender,
            } if patient else None,
            "doctor": {
                "id": doctor.id,
                "name": doctor.name,
                "specialization": doctor.specialization,
            } if doctor else None,
            "triage": {
                "score": triage.score,
                "priority_level": triage.priority_level,
                "queue_position": triage.queue_position,
            } if triage else None,
        })

    return {"success": True, "data": response}


@router.patch("/{queue_id}/status")
async def update_queue_status(
    queue_id: int,
    body: QueueStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    valid = {"waiting", "in_consultation", "completed"}
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid}")

    result = await db.execute(select(OPDQueue).where(OPDQueue.id == queue_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")

    entry.status = body.status
    await db.commit()

    # Emit queue_update with fresh KPIs
    queue_count_result = await db.execute(
        select(func.count(OPDQueue.id)).where(OPDQueue.status == "waiting")
    )
    queue_count = queue_count_result.scalar() or 0

    await emit_queue_update({
        "currentQueueLength": queue_count,
        "updatedEntryId": queue_id,
        "newStatus": body.status,
    })

    return {"success": True, "data": {"id": queue_id, "status": body.status}, "message": "Queue status updated"}


@router.get("/doctors")
async def get_doctors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Doctor))
    doctors = result.scalars().all()
    return {
        "success": True,
        "data": [
            {"id": d.id, "name": d.name, "specialization": d.specialization, "status": d.status}
            for d in doctors
        ]
    }
