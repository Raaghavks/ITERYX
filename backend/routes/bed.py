from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.models.bed import Ward, Bed, DischargeOrder
from backend.models.patient import Patient
from backend.models.queue import Doctor
from backend.sockets.events import emit_bed_update

router = APIRouter()


# ─── Pydantic Schemas ───────────────────────────────────────────────────────


class BedStatusUpdate(BaseModel):
    status: str
    patient_id: Optional[int] = None


class DischargeOrderCreate(BaseModel):
    patient_id: int
    doctor_id: int
    bed_id: Optional[int] = None
    expected_discharge_at: str  # ISO datetime string


# ─── Ward Endpoints ──────────────────────────────────────────────────────────


@router.get("/wards")
async def get_all_wards(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Ward))
    wards = result.scalars().all()

    response = []
    for ward in wards:
        # Count beds per status for this ward
        beds_result = await db.execute(select(Bed).where(Bed.ward_id == ward.id))
        beds = beds_result.scalars().all()

        occupied = sum(1 for b in beds if b.status == "occupied")
        available = sum(1 for b in beds if b.status == "available")
        reserved = sum(1 for b in beds if b.status == "reserved")
        maintenance = sum(1 for b in beds if b.status == "maintenance")

        response.append({
            "id": ward.id,
            "name": ward.name,
            "location": ward.location,
            "bed_count": ward.bed_count,
            "total_beds": len(beds),
            "occupied_beds": occupied,
            "available_beds": available,
            "reserved_beds": reserved,
            "maintenance_beds": maintenance,
        })

    return {"success": True, "data": response}


# ─── Bed Endpoints ───────────────────────────────────────────────────────────


@router.get("/beds")
async def get_all_beds(
    ward_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Bed)
    if ward_id:
        query = query.where(Bed.ward_id == ward_id)

    result = await db.execute(query)
    beds = result.scalars().all()

    response = []
    for bed in beds:
        # Fetch assigned patient if any
        patient_data = None
        if bed.assigned_patient_id:
            p_result = await db.execute(
                select(Patient).where(Patient.id == bed.assigned_patient_id)
            )
            patient = p_result.scalar_one_or_none()
            if patient:
                initials = ".".join(part[0].upper() for part in patient.name.split() if part)
                patient_data = {
                    "id": patient.id,
                    "name": patient.name,
                    "initials": initials,
                }

        # Fetch admission info for admitted_since + doctor
        admitted_since = None
        assigned_doctor = None
        if bed.status == "occupied" and bed.assigned_patient_id:
            from backend.models.bed import Admission
            adm_result = await db.execute(
                select(Admission)
                .where(Admission.bed_id == bed.id)
                .where(Admission.discharged_at.is_(None))
                .order_by(Admission.admitted_at.desc())
            )
            admission = adm_result.scalar_one_or_none()
            if admission:
                admitted_since = admission.admitted_at.isoformat()
                doc_result = await db.execute(
                    select(Doctor).where(Doctor.id == admission.doctor_id)
                )
                doc = doc_result.scalar_one_or_none()
                assigned_doctor = doc.name if doc else None

        # Fetch ward name
        ward_result = await db.execute(select(Ward).where(Ward.id == bed.ward_id))
        ward = ward_result.scalar_one_or_none()

        response.append({
            "id": bed.id,
            "ward_id": bed.ward_id,
            "ward_name": ward.name if ward else None,
            "number": bed.bed_number,
            "status": bed.status,
            "patient": patient_data,
            "patient_initials": patient_data["initials"] if patient_data else None,
            "patient_name": patient_data["name"] if patient_data else None,
            "admitted_since": admitted_since,
            "assigned_doctor": assigned_doctor,
            "last_updated": bed.last_updated.isoformat() if bed.last_updated else None,
        })

    return {"success": True, "data": response}


@router.get("/beds/{bed_id}")
async def get_bed(bed_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bed).where(Bed.id == bed_id))
    bed = result.scalar_one_or_none()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")

    ward_result = await db.execute(select(Ward).where(Ward.id == bed.ward_id))
    ward = ward_result.scalar_one_or_none()

    return {
        "success": True,
        "data": {
            "id": bed.id,
            "ward_id": bed.ward_id,
            "ward_name": ward.name if ward else None,
            "number": bed.bed_number,
            "status": bed.status,
            "assigned_patient_id": bed.assigned_patient_id,
        }
    }


@router.patch("/beds/{bed_id}/status")
async def update_bed_status(
    bed_id: int,
    body: BedStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    valid_statuses = {"available", "occupied", "reserved", "maintenance"}
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    result = await db.execute(select(Bed).where(Bed.id == bed_id))
    bed = result.scalar_one_or_none()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")

    from datetime import datetime
    bed.status = body.status
    bed.last_updated = datetime.utcnow()

    if body.patient_id is not None:
        bed.assigned_patient_id = body.patient_id
    elif body.status == "available":
        bed.assigned_patient_id = None

    await db.commit()
    await db.refresh(bed)

    # Emit real-time socket event
    patient_name = None
    if bed.assigned_patient_id:
        p_result = await db.execute(select(Patient).where(Patient.id == bed.assigned_patient_id))
        p = p_result.scalar_one_or_none()
        patient_name = p.name if p else None

    await emit_bed_update(
        ward_id=bed.ward_id,
        bed_id=bed.id,
        new_status=bed.status,
        patient_name=patient_name,
    )

    return {"success": True, "data": {"id": bed.id, "status": bed.status}, "message": "Bed status updated"}


# ─── Discharge Orders ────────────────────────────────────────────────────────


@router.get("/discharge-orders/pending")
async def get_pending_discharge_orders(db: AsyncSession = Depends(get_db)):
    from datetime import datetime
    result = await db.execute(
        select(DischargeOrder).where(DischargeOrder.confirmed_at.is_(None))
    )
    orders = result.scalars().all()

    response = []
    for order in orders:
        patient_result = await db.execute(select(Patient).where(Patient.id == order.patient_id))
        patient = patient_result.scalar_one_or_none()

        bed_data = None
        ward_name = None
        if order.bed_id:
            bed_result = await db.execute(select(Bed).where(Bed.id == order.bed_id))
            bed = bed_result.scalar_one_or_none()
            if bed:
                bed_data = bed.bed_number
                ward_result = await db.execute(select(Ward).where(Ward.id == bed.ward_id))
                ward = ward_result.scalar_one_or_none()
                ward_name = ward.name if ward else None

        response.append({
            "id": order.id,
            "patient_id": order.patient_id,
            "patient_name": patient.name if patient else "Unknown",
            "bed_number": bed_data or "N/A",
            "ward_name": ward_name or "N/A",
            "expected_discharge_at": order.expected_discharge_at.isoformat(),
            "confirmed_at": order.confirmed_at.isoformat() if order.confirmed_at else None,
        })

    return {"success": True, "data": response}


@router.post("/discharge-orders")
async def create_discharge_order(body: DischargeOrderCreate, db: AsyncSession = Depends(get_db)):
    from datetime import datetime
    expected_at = datetime.fromisoformat(body.expected_discharge_at)
    order = DischargeOrder(
        patient_id=body.patient_id,
        doctor_id=body.doctor_id,
        bed_id=body.bed_id,
        expected_discharge_at=expected_at,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return {"success": True, "data": {"id": order.id}, "message": "Discharge order created"}
