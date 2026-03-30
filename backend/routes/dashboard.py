from fastapi import APIRouter
from backend.database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/kpis")
async def get_dashboard_kpis():
    """
    Returns high-level KPIs for the hospital dashboard:
    1. Total Patients Today (registered in the last 24h)
    2. Current Queue Length (waiting)
    3. Overall Bed Occupancy percentage
    4. Critical Patients count
    """
    with get_db() as cur:
        # 1. Total Patients Today
        cur.execute("SELECT COUNT(*) as count FROM patients WHERE registered_at >= NOW() - INTERVAL '24 hours'")
        total_patients = cur.fetchone()["count"]

        # 2. Current Queue Length
        cur.execute("SELECT COUNT(*) as count FROM opd_queue WHERE status = 'waiting'")
        queue_length = cur.fetchone()["count"]

        # 3. Overall Bed Occupancy
        cur.execute("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'occupied') as occupied FROM beds")
        bed_stats = cur.fetchone()
        total_beds = bed_stats["total"] or 1
        occupied_beds = bed_stats["occupied"] or 0
        occupancy_rate = round((occupied_beds / total_beds) * 100)

        # 4. Critical Patients (based on triage score priority)
        cur.execute("SELECT COUNT(*) as count FROM triage_scores WHERE priority_level = 'CRITICAL'")
        critical_patients = cur.fetchone()["count"]

    return {
        "totalPatientsToday": total_patients,
        "currentQueueLength": queue_length,
        "overallBedOccupancy": occupancy_rate,
        "criticalPatients": critical_patients
    }
