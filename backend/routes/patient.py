from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from pydantic import BaseModel

from backend.database import get_db
from backend.models.patient import Patient, Vitals, Symptom, TriageScore
from backend.models.queue import OPDQueue, Doctor
from backend.sockets.events import emit_emergency_alert

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────


class VitalsIn(BaseModel):
    heart_rate: int
    bp_systolic: int
    bp_diastolic: int
    temperature: float
    spo2: int
    respiratory_rate: Optional[int] = None


class SymptomIn(BaseModel):
    symptom: str
    severity_code: Optional[int] = None


class PatientRegisterRequest(BaseModel):
    name: str
    age: int
    gender: str
    contact: Optional[str] = None
    doctor_id: int
    vitals: VitalsIn
    symptoms: List[SymptomIn]


# ─── Triage Scoring (Rule-based fallback) ────────────────────────────────────


def compute_triage_score(vitals: VitalsIn, symptoms: List[SymptomIn]) -> tuple[float, str]:
    """
    Simple rule-based triage scoring.
    Returns (score 0-100, priority_level: CRITICAL|HIGH|MEDIUM|LOW)
    """
    score = 0.0

    # SpO2 scoring
    if vitals.spo2 < 90:
        score += 40
    elif vitals.spo2 < 95:
        score += 20
    else:
        score += 5

    # Heart rate
    if vitals.heart_rate > 120 or vitals.heart_rate < 50:
        score += 25
    elif vitals.heart_rate > 100:
        score += 12

    # Blood pressure
    if vitals.bp_systolic > 160 or vitals.bp_systolic < 90:
        score += 15
    elif vitals.bp_systolic > 140:
        score += 7

    # Temperature
    if vitals.temperature > 102:
        score += 10
    elif vitals.temperature > 100:
        score += 5

    # Respiratory rate
    if vitals.respiratory_rate:
        if vitals.respiratory_rate > 30 or vitals.respiratory_rate < 10:
            score += 10

    # High-severity symptoms
    critical_keywords = {"unconscious", "seizure", "chest pain", "breathing difficulty", "asthma attack"}
    for s in symptoms:
        if any(kw in s.symptom.lower() for kw in critical_keywords):
            score += 10
            break

    score = min(score, 100.0)

    if score >= 70:
        priority = "CRITICAL"
    elif score >= 45:
        priority = "HIGH"
    elif score >= 25:
        priority = "MEDIUM"
    else:
        priority = "LOW"

    return round(score, 1), priority


# ─── Patient Endpoints ───────────────────────────────────────────────────────


@router.get("")
async def get_patients(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Patient).order_by(Patient.registered_at.desc()))
    patients = result.scalars().all()
    return {
        "success": True,
        "data": [
            {
                "id": p.id,
                "name": p.name,
                "age": p.age,
                "gender": p.gender,
                "contact": p.contact,
                "registered_at": p.registered_at.isoformat(),
            }
            for p in patients
        ]
    }


@router.get("/{patient_id}")
async def get_patient(patient_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Latest vitals
    vitals_result = await db.execute(
        select(Vitals)
        .where(Vitals.patient_id == patient_id)
        .order_by(Vitals.recorded_at.desc())
    )
    vitals = vitals_result.scalar_one_or_none()

    # Symptoms
    syms_result = await db.execute(select(Symptom).where(Symptom.patient_id == patient_id))
    symptoms = syms_result.scalars().all()

    # Latest triage
    triage_result = await db.execute(
        select(TriageScore)
        .where(TriageScore.patient_id == patient_id)
        .order_by(TriageScore.computed_at.desc())
    )
    triage = triage_result.scalar_one_or_none()

    return {
        "success": True,
        "data": {
            "id": patient.id,
            "name": patient.name,
            "age": patient.age,
            "gender": patient.gender,
            "contact": patient.contact,
            "registered_at": patient.registered_at.isoformat(),
            "vitals": {
                "heart_rate": vitals.heart_rate,
                "bp_systolic": vitals.bp_systolic,
                "bp_diastolic": vitals.bp_diastolic,
                "temperature": vitals.temperature,
                "spo2": vitals.spo2,
                "respiratory_rate": vitals.respiratory_rate,
            } if vitals else None,
            "symptoms": [{"symptom": s.symptom, "severity_code": s.severity_code} for s in symptoms],
            "triage": {
                "score": triage.score,
                "priority_level": triage.priority_level,
                "queue_position": triage.queue_position,
                "computed_at": triage.computed_at.isoformat(),
            } if triage else None,
        }
    }


@router.post("/register")
async def register_patient(body: PatientRegisterRequest, db: AsyncSession = Depends(get_db)):
    # 1. Create patient
    patient = Patient(
        name=body.name,
        age=body.age,
        gender=body.gender,
        contact=body.contact,
    )
    db.add(patient)
    await db.flush()  # Get patient.id

    # 2. Record vitals
    vitals = Vitals(
        patient_id=patient.id,
        heart_rate=body.vitals.heart_rate,
        bp_systolic=body.vitals.bp_systolic,
        bp_diastolic=body.vitals.bp_diastolic,
        temperature=body.vitals.temperature,
        spo2=body.vitals.spo2,
        respiratory_rate=body.vitals.respiratory_rate,
    )
    db.add(vitals)

    # 3. Record symptoms
    for sym in body.symptoms:
        db.add(Symptom(
            patient_id=patient.id,
            symptom=sym.symptom,
            severity_code=sym.severity_code,
        ))

    # 4. Compute triage score
    score, priority = compute_triage_score(body.vitals, body.symptoms)

    # Determine queue position: count waiting + 1
    pos_result = await db.execute(
        select(func.count(OPDQueue.id)).where(OPDQueue.status == "waiting")
    )
    queue_pos = (pos_result.scalar() or 0) + 1

    triage_record = TriageScore(
        patient_id=patient.id,
        score=score,
        priority_level=priority,
        queue_position=queue_pos,
    )
    db.add(triage_record)

    # 5. Add to OPD queue
    queue_entry = OPDQueue(
        patient_id=patient.id,
        doctor_id=body.doctor_id,
        queue_position=queue_pos,
        status="waiting",
    )
    db.add(queue_entry)

    await db.commit()
    await db.refresh(patient)

    # 6. Emit emergency alert if CRITICAL or HIGH
    if priority in ("CRITICAL", "HIGH"):
        await emit_emergency_alert(
            patient_name=patient.name,
            priority=priority,
            score=score,
        )

    return {
        "success": True,
        "data": {
            "patient_id": patient.id,
            "name": patient.name,
            "triage_score": score,
            "priority_level": priority,
            "queue_position": queue_pos,
        },
        "message": f"Patient registered. Priority: {priority}. Queue position: {queue_pos}."
    }
