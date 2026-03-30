from fastapi import APIRouter, HTTPException, Query
from typing import List
from pydantic import BaseModel
import joblib
import os
import pandas as pd
from datetime import datetime, timezone

from backend.api_contract import success_response
from backend.database import get_db

try:
    from backend.sockets.events import sio, emit_emergency_alert
except ImportError:
    sio = None
    emit_emergency_alert = None

router = APIRouter(prefix="/api/triage", tags=["Triage"])
router_patients = APIRouter(prefix="/api/patients", tags=["Patients"])
router_queue = APIRouter(prefix="/api/queue", tags=["Queue"])

DB_QUEUE_STATUS = {
    "waiting": "WAITING",
    "in_consultation": "IN_CONSULTATION",
    "completed": "COMPLETED",
}


def from_db_queue_status(value: str) -> str:
    return value.lower()

SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRIAGE_MODEL_PATH = os.path.join(SCRIPT_DIR, "ml", "triage_model.pkl")

try:
    triage_model_data = joblib.load(TRIAGE_MODEL_PATH)
    xgb_model = triage_model_data["model"]
    label_encoder = triage_model_data["label_encoder"]
    model_features = triage_model_data["features"]
except Exception as e:
    print(f"Warning: Could not load triage model: {e}")
    triage_model_data = None


# ── Pydantic request schemas ────────────────────────────────────────────

class SymptomCreate(BaseModel):
    symptom_text: str
    severity_code: int

class VitalsCreate(BaseModel):
    bp_systolic: int
    bp_diastolic: int
    spo2: int
    temperature: float
    heart_rate: int

class PatientRegister(BaseModel):
    name: str
    age: int
    gender: str
    contact: str
    vitals: VitalsCreate
    symptoms: List[SymptomCreate]

class ScoreRequest(BaseModel):
    patient_id: int
    doctor_id: int | None = None

class StatusUpdate(BaseModel):
    status: str

# 1. POST /api/patients/register
@router_patients.post("/register")
async def register_patient(data: PatientRegister):
    with get_db() as cur:
        # Insert Patient
        cur.execute(
            """
            INSERT INTO patients (name, age, gender, contact, registered_at)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (data.name, data.age, data.gender, data.contact, datetime.now(timezone.utc))
        )
        patient_id = cur.fetchone()["id"]

        # Insert Vitals
        cur.execute(
            """
            INSERT INTO vitals (patient_id, bp_systolic, bp_diastolic, spo2, temperature, heart_rate, recorded_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s);
            """,
            (patient_id, data.vitals.bp_systolic, data.vitals.bp_diastolic, data.vitals.spo2, 
             data.vitals.temperature, data.vitals.heart_rate, datetime.now(timezone.utc))
        )

        # Insert Symptoms
        for sym in data.symptoms:
            cur.execute(
                """
                INSERT INTO symptoms (patient_id, symptom_text, severity_code)
                VALUES (%s, %s, %s);
                """,
                (patient_id, sym.symptom_text, sym.severity_code)
            )

    return success_response(
        data={"patient_id": patient_id},
        message="Patient registered successfully",
        status_code=201,
    )

# 2. POST /api/triage/score
@router.post("/score")
async def score_patient(data: ScoreRequest):
    with get_db() as cur:
        # Fetch patient
        cur.execute("SELECT age FROM patients WHERE id = %s", (data.patient_id,))
        patient = cur.fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        # Fetch latest vitals
        cur.execute(
            "SELECT bp_systolic, spo2, temperature, heart_rate FROM vitals WHERE patient_id = %s ORDER BY recorded_at DESC LIMIT 1",
            (data.patient_id,)
        )
        vitals = cur.fetchone()

        # Fetch symptoms
        cur.execute(
            "SELECT symptom_text, severity_code FROM symptoms WHERE patient_id = %s",
            (data.patient_id,)
        )
        symptoms = cur.fetchall()

    if not vitals or not symptoms:
        raise HTTPException(status_code=400, detail="Vitals or symptoms missing for patient")

    critical_symptoms = ["chest pain", "breathing difficulty", "asthma attack", "unconscious", "seizure"]
    is_critical_override = False
    
    if vitals["spo2"] < 90 or vitals["heart_rate"] > 120:
        is_critical_override = True
        
    for sym in symptoms:
        if sym["symptom_text"].lower() in critical_symptoms:
            is_critical_override = True
            break
            
    score = 0.0
    priority_level = "LOW"
    
    if is_critical_override:
        priority_level = "CRITICAL"
        score = 95.0
    else:
        if triage_model_data:
            symptom_severity_max = max((s["severity_code"] for s in symptoms), default=1)
            symptom_count = len(symptoms)
            
            input_df = pd.DataFrame([{
                "age": patient["age"],
                "bp_systolic": vitals["bp_systolic"],
                "spo2": vitals["spo2"],
                "temperature": vitals["temperature"],
                "heart_rate": vitals["heart_rate"],
                "symptom_severity_max": symptom_severity_max,
                "symptom_count": symptom_count
            }])
            
            input_df = input_df[model_features]
            preds = xgb_model.predict(input_df)
            probas = xgb_model.predict_proba(input_df)[0]
            
            predicted_class = label_encoder.inverse_transform(preds)[0]
            priority_level = predicted_class
            
            classes = list(label_encoder.classes_)
            def get_prob(cls_name):
                if cls_name in classes:
                    return probas[classes.index(cls_name)]
                return 0.0
                
            score = (
                get_prob("CRITICAL") * 90 + 
                get_prob("HIGH") * 70 + 
                get_prob("MEDIUM") * 50 + 
                get_prob("LOW") * 20
            )
            score = min(score, 94.0)
        else:
            score = 30.0
            priority_level = "LOW"

    score = float(score)

    with get_db() as cur:
        # Calculate queue position
        cur.execute(
            """
            SELECT COUNT(*) as count 
            FROM opd_queue o
            JOIN triage_scores t ON o.patient_id = t.patient_id
            WHERE o.status = 'WAITING' AND t.score > %s
            """,
            (score,)
        )
        higher_score_count = cur.fetchone()["count"]
        queue_position = higher_score_count + 1

        # Delete old score if any, insert new score
        cur.execute("DELETE FROM triage_scores WHERE patient_id = %s", (data.patient_id,))
        cur.execute(
            """
            INSERT INTO triage_scores (patient_id, score, priority_level, queue_position, computed_at)
            VALUES (%s, %s, %s, %s, %s);
            """,
            (data.patient_id, score, priority_level, queue_position, datetime.now(timezone.utc))
        )

        doctor_id = data.doctor_id
        if doctor_id is not None:
            cur.execute("SELECT id FROM doctors WHERE id = %s", (doctor_id,))
            selected_doctor = cur.fetchone()
            if not selected_doctor:
                raise HTTPException(status_code=404, detail="Selected doctor not found")
        else:
            # Fall back to the first available doctor when none is selected by intake staff.
            cur.execute("SELECT id FROM doctors WHERE is_available = TRUE ORDER BY id ASC LIMIT 1")
            doc = cur.fetchone()
            if not doc:
                # Fallback to general doctor or ID 1
                cur.execute("SELECT id FROM doctors WHERE id = 1")
                doc = cur.fetchone()
                if not doc:
                    cur.execute(
                        "INSERT INTO doctors (name, specialization, is_available) VALUES (%s, %s, TRUE) RETURNING id",
                        ("Default Doctor", "General")
                    )
                    doc = cur.fetchone()

            doctor_id = doc["id"]

        # Insert or update opd_queue
        cur.execute("SELECT id FROM opd_queue WHERE patient_id = %s AND status != 'COMPLETED'", (data.patient_id,))
        q_ext = cur.fetchone()
        if q_ext:
            cur.execute(
                """
                UPDATE opd_queue 
                SET doctor_id = %s, queue_position = %s, status = 'WAITING' 
                WHERE id = %s
                """,
                (doctor_id, queue_position, q_ext["id"])
            )
        else:
            cur.execute(
                """
                INSERT INTO opd_queue (patient_id, doctor_id, queue_position, status, created_at)
                VALUES (%s, %s, %s, 'WAITING', %s);
                """,
                (data.patient_id, doctor_id, queue_position, datetime.now(timezone.utc))
            )

    if sio:
        await sio.emit("queue_update", {"event": "new_patient", "patient_id": data.patient_id})
        if emit_emergency_alert and priority_level == "CRITICAL":
            with get_db() as cur:
                cur.execute("SELECT name FROM patients WHERE id = %s", (data.patient_id,))
                patient_row = cur.fetchone()
                patient_name = patient_row["name"] if patient_row else "Unknown Patient"
            await emit_emergency_alert(patient_name, priority_level, score)

    return success_response(
        data={
            "score": score,
            "priority_level": priority_level,
            "queue_position": queue_position,
            "doctor_id": doctor_id,
        },
        message="Triage score calculated and patient added to queue",
    )

# 3. GET /api/queue/opd
@router_queue.get("/opd")
async def get_opd_queue(status: str | None = Query(default=None)):
    valid_statuses = {"waiting", "in_consultation", "completed"}
    if status and status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status filter")

    with get_db() as cur:
        params = []
        query = """
            SELECT 
                o.id as queue_id,
                o.doctor_id,
                o.status,
                p.id as patient_id, 
                p.name,
                p.gender,
                p.age, 
                d.name as doctor_name,
                t.score, 
                t.priority_level,
                o.created_at as queued_at
            FROM opd_queue o
            JOIN patients p ON o.patient_id = p.id
            JOIN triage_scores t ON o.patient_id = t.patient_id
            LEFT JOIN doctors d ON o.doctor_id = d.id
        """

        if status:
            query += " WHERE o.status = %s"
            params.append(DB_QUEUE_STATUS[status])

        query += " ORDER BY t.score DESC, o.created_at ASC;"
        cur.execute(query, params)
        rows = cur.fetchall()

        queue_list = []
        for idx, row in enumerate(rows):
            # Fetch first symptom
            cur.execute(
                "SELECT symptom_text FROM symptoms WHERE patient_id = %s ORDER BY id ASC LIMIT 1",
                (row["patient_id"],)
            )
            first_sym = cur.fetchone()
            chief_complaint = first_sym["symptom_text"] if first_sym else "Unknown"

            if row["queued_at"].tzinfo is None:
                q_time = row["queued_at"].replace(tzinfo=timezone.utc)
            else:
                q_time = row["queued_at"]
                
            wait_time_mins = int((datetime.now(timezone.utc) - q_time).total_seconds() / 60)

            queue_list.append({
                "id": row["queue_id"],
                "patient_id": row["patient_id"],
                "name": row["name"],
                "age": row["age"],
                "gender": row["gender"],
                "doctor_id": row["doctor_id"],
                "doctor_name": row["doctor_name"],
                "chief_complaint": chief_complaint,
                "score": round(row["score"], 2),
                "priority_level": row["priority_level"],
                "queue_position": idx + 1,
                "status": from_db_queue_status(row["status"]),
                "created_at": q_time.isoformat(),
                "wait_time_mins": max(0, wait_time_mins)
            })

    return success_response(
        data=queue_list,
        message="OPD queue retrieved",
    )

# 4. PATCH /api/queue/{queue_id}/status
@router_queue.patch("/{queue_id}/status")
async def update_queue_status(queue_id: int, data: StatusUpdate):
    valid_statuses = ["in_consultation", "completed", "waiting"]
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    with get_db() as cur:
        cur.execute("SELECT id, patient_id, status FROM opd_queue WHERE id = %s", (queue_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Queue entry not found")
            
        cur.execute(
            "UPDATE opd_queue SET status = %s WHERE id = %s",
            (DB_QUEUE_STATUS[data.status], queue_id)
        )
        
    if sio:
        await sio.emit("queue_update", {"event": "status_change", "queue_id": queue_id, "status": data.status})
        
    return success_response(
        data={
            "queue_id": queue_id,
            "patient_id": existing["patient_id"],
            "previous_status": from_db_queue_status(existing["status"]),
            "new_status": data.status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        message=f"Queue status updated to {data.status}",
    )
