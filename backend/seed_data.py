import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor, execute_values
from dotenv import load_dotenv


WARD_ROWS = [
    {"name": "General Ward", "floor": 1, "total_beds": 20},
    {"name": "ICU", "floor": 2, "total_beds": 10},
    {"name": "Pediatric Ward", "floor": 1, "total_beds": 15},
    {"name": "Orthopedic Ward", "floor": 3, "total_beds": 12},
    {"name": "Emergency Ward", "floor": 0, "total_beds": 8},
]

DOCTOR_ROWS = [
    ("Dr. Arun Sharma", "General Physician", True),
    ("Dr. Priya Nair", "Cardiologist", True),
    ("Dr. Karan Mehta", "Pediatrician", True),
    ("Dr. Sneha Iyer", "Emergency Medicine", True),
    ("Dr. Raj Patel", "Orthopedic Surgeon", False),
    ("Dr. Meera Krishnan", "General Physician", True),
    ("Dr. Vikram Das", "Pulmonologist", True),
    ("Dr. Anitha Rao", "Neurologist", False),
]

PATIENT_NAMES = [
    "Arun Kumar",
    "Priya Lakshmi",
    "Karthik Raj",
    "Nivetha Devi",
    "Santhosh Kumar",
    "Meena Subramani",
    "Vignesh Babu",
    "Aishwarya R",
    "Raghavan Iyer",
    "Divya Balaji",
    "Madhan Gopal",
    "Keerthana S",
    "Suresh Narayanan",
    "Pavithra M",
    "Pranav Chandran",
    "Harini K",
    "Saravanan P",
    "Gayathri V",
    "Ashwin M",
    "Revathi R",
    "Rithika N",
    "Tharun E",
    "Janani U",
    "Manoj K",
    "Vaishnavi T",
]

SYMPTOM_POOL = [
    "chest pain",
    "breathing difficulty",
    "fever",
    "headache",
    "fracture",
    "asthma attack",
    "vomiting",
    "dizziness",
    "abdominal pain",
    "unconscious",
    "chest tightness",
    "seizure",
]

PRIORITY_TO_SCORE = {
    "CRITICAL": 95.0,
    "HIGH": 72.0,
    "MEDIUM": 52.0,
    "LOW": 24.0,
}


def load_environment():
    backend_dir = Path(__file__).resolve().parent
    root_dir = backend_dir.parent
    load_dotenv(root_dir / ".env")
    load_dotenv(backend_dir / ".env")


def get_connection():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set. Add it to .env before running seed_data.py")
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)


def truncate_all_tables(cursor):
    cursor.execute(
        """
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename;
        """
    )
    tables = [row["tablename"] for row in cursor.fetchall()]
    if not tables:
        return

    query = sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE;").format(
        sql.SQL(", ").join(sql.Identifier("public", table) for table in tables)
    )
    cursor.execute(query)


def insert_wards(cursor):
    ward_payload = [(row["name"], row["total_beds"], row["floor"]) for row in WARD_ROWS]
    execute_values(
        cursor,
        """
        INSERT INTO wards (name, total_beds, floor)
        VALUES %s
        RETURNING id, total_beds;
        """,
        ward_payload,
    )
    wards = cursor.fetchall()
    print("[ok] wards inserted")
    return wards


def build_statuses(total):
    weighted = {
        "OCCUPIED": total * 0.55,
        "AVAILABLE": total * 0.25,
        "RESERVED": total * 0.15,
        "MAINTENANCE": total * 0.05,
    }

    base_counts = {key: int(value) for key, value in weighted.items()}
    assigned = sum(base_counts.values())
    remainder = total - assigned

    if remainder > 0:
        by_fraction = sorted(
            weighted.items(),
            key=lambda item: (item[1] - int(item[1])),
            reverse=True,
        )
        for index in range(remainder):
            base_counts[by_fraction[index][0]] += 1

    statuses = []
    for status, count in base_counts.items():
        statuses.extend([status] * count)

    random.shuffle(statuses)
    return statuses


def insert_beds(cursor, ward_rows):
    total_beds = sum(row["total_beds"] for row in ward_rows)
    statuses = build_statuses(total_beds)
    now = datetime.now(timezone.utc)

    bed_rows = []
    status_index = 0
    for row in ward_rows:
        ward_id = row["id"]
        ward_bed_count = row["total_beds"]
        for local_index in range(ward_bed_count):
            bed_rows.append(
                (
                    ward_id,
                    f"B{ward_id:02d}-{local_index + 1:02d}",
                    statuses[status_index],
                    now,
                )
            )
            status_index += 1

    execute_values(
        cursor,
        """
        INSERT INTO beds (ward_id, bed_number, status, last_updated)
        VALUES %s
        RETURNING id, ward_id, bed_number, status;
        """,
        bed_rows,
    )
    beds = cursor.fetchall()
    print(f"[ok] beds inserted ({len(beds)} total)")
    return beds


def insert_doctors(cursor):
    execute_values(
        cursor,
        """
        INSERT INTO doctors (name, specialization, is_available)
        VALUES %s
        RETURNING id, is_available;
        """,
        DOCTOR_ROWS,
    )
    doctors = cursor.fetchall()
    print("[ok] doctors inserted")
    return doctors


def insert_patients(cursor):
    random.seed(42)
    ages = [5, 8, 11, 14, 17, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 52, 56, 60, 64, 68, 72, 76, 79, 82, 85]
    genders = ["male", "female", "male", "female", "male"]
    now = datetime.now(timezone.utc)

    patient_rows = []
    for index, name in enumerate(PATIENT_NAMES):
        patient_rows.append(
            (
                name,
                ages[index],
                genders[index % len(genders)],
                f"9{index + 1:09d}",
                now - timedelta(minutes=index * 7),
            )
        )

    execute_values(
        cursor,
        """
        INSERT INTO patients (name, age, gender, contact, registered_at)
        VALUES %s
        RETURNING id;
        """,
        patient_rows,
    )
    patient_ids = [row["id"] for row in cursor.fetchall()]
    print("[ok] patients inserted")
    return patient_ids


def insert_vitals(cursor, patient_ids):
    random.seed(43)
    vitals_rows = []
    now = datetime.now(timezone.utc)

    for index, patient_id in enumerate(patient_ids):
        vitals_rows.append(
            (
                patient_id,
                random.randint(108, 145),
                random.randint(68, 96),
                random.randint(88, 100),
                round(random.uniform(97.6, 101.4), 1),
                random.randint(68, 135),
                now - timedelta(minutes=index * 5),
            )
        )

    execute_values(
        cursor,
        """
        INSERT INTO vitals (patient_id, bp_systolic, bp_diastolic, spo2, temperature, heart_rate, recorded_at)
        VALUES %s;
        """,
        vitals_rows,
    )
    print("[ok] vitals inserted")


def insert_symptoms(cursor, patient_ids):
    random.seed(44)
    symptom_rows = []

    for patient_id in patient_ids:
        count = random.randint(1, 3)
        picked = random.sample(SYMPTOM_POOL, count)
        for symptom in picked:
            severity = random.randint(2, 5) if symptom in {"chest pain", "breathing difficulty", "unconscious", "seizure"} else random.randint(1, 4)
            symptom_rows.append((patient_id, symptom, severity))

    execute_values(
        cursor,
        """
        INSERT INTO symptoms (patient_id, symptom_text, severity_code)
        VALUES %s;
        """,
        symptom_rows,
    )
    print("[ok] symptoms inserted")


def classify_patient(index):
    if index < 4:
        return "CRITICAL"
    if index < 10:
        return "HIGH"
    if index < 18:
        return "MEDIUM"
    return "LOW"


def insert_queue_and_triage(cursor, patient_ids, doctors):
    available_doctor_ids = [row["id"] for row in doctors if row["is_available"]]
    queue_patient_ids = patient_ids[:15]
    now = datetime.now(timezone.utc)

    triage_rows = []
    queue_rows = []

    for position, patient_id in enumerate(queue_patient_ids, start=1):
        priority = classify_patient(position - 1)
        score = PRIORITY_TO_SCORE[priority] - (position * 0.3)
        computed_at = now - timedelta(minutes=position * 4)
        triage_rows.append((patient_id, score, priority, position, computed_at))

        queue_rows.append(
            (
                patient_id,
                available_doctor_ids[(position - 1) % len(available_doctor_ids)],
                position,
                "WAITING",
                now - timedelta(minutes=position * 4),
            )
        )

    execute_values(
        cursor,
        """
        INSERT INTO triage_scores (patient_id, score, priority_level, queue_position, computed_at)
        VALUES %s;
        """,
        triage_rows,
    )

    execute_values(
        cursor,
        """
        INSERT INTO opd_queue (patient_id, doctor_id, queue_position, status, created_at)
        VALUES %s;
        """,
        queue_rows,
    )
    print("[ok] triage scores and opd queue inserted")


def assign_beds_and_admissions(cursor, beds, patient_ids, doctors):
    random.seed(45)
    available_doctor_ids = [row["id"] for row in doctors if row["is_available"]]
    free_patient_ids = patient_ids[15:]
    now = datetime.now(timezone.utc)

    occupied_beds = [bed for bed in beds if bed["status"] == "OCCUPIED"]
    reserved_beds = [bed for bed in beds if bed["status"] == "RESERVED"]

    occupied_assignments = []
    admission_rows = []

    for index, bed in enumerate(occupied_beds[:8]):
        patient_id = free_patient_ids[index]
        doctor_id = available_doctor_ids[index % len(available_doctor_ids)]
        admitted_at = now - timedelta(hours=index + 2)
        occupied_assignments.append((patient_id, bed["id"]))
        admission_rows.append((patient_id, bed["id"], doctor_id, admitted_at))

    if occupied_assignments:
        execute_values(
            cursor,
            """
            UPDATE beds AS b
            SET assigned_patient_id = v.patient_id
            FROM (VALUES %s) AS v(patient_id, bed_id)
            WHERE b.id = v.bed_id;
            """,
            occupied_assignments,
        )

        execute_values(
            cursor,
            """
            INSERT INTO admissions (patient_id, bed_id, doctor_id, admitted_at)
            VALUES %s;
            """,
            admission_rows,
        )

    reserved_assignments = []
    for offset, bed in enumerate(reserved_beds[:4], start=len(occupied_assignments)):
        if offset >= len(free_patient_ids):
            break
        reserved_assignments.append((free_patient_ids[offset], bed["id"]))

    if reserved_assignments:
        execute_values(
            cursor,
            """
            UPDATE beds AS b
            SET assigned_patient_id = v.patient_id
            FROM (VALUES %s) AS v(patient_id, bed_id)
            WHERE b.id = v.bed_id;
            """,
            reserved_assignments,
        )

    print("[ok] admissions and bed assignments inserted")
    return admission_rows


def insert_discharge_orders(cursor, admission_rows):
    now = datetime.now(timezone.utc)
    discharge_rows = []

    for index, (patient_id, bed_id, doctor_id, _) in enumerate(admission_rows[:3]):
        discharge_rows.append(
            (
                patient_id,
                bed_id,
                doctor_id,
                now + timedelta(minutes=30 * (index + 1)),
            )
        )

    if discharge_rows:
        execute_values(
            cursor,
            """
            INSERT INTO discharge_orders (patient_id, bed_id, doctor_id, expected_discharge_at)
            VALUES %s;
            """,
            discharge_rows,
        )

    print("[ok] discharge orders inserted")


def main():
    random.seed(7)
    load_environment()

    connection = get_connection()
    try:
        with connection:
            with connection.cursor() as cursor:
                truncate_all_tables(cursor)

                ward_rows = insert_wards(cursor)
                beds = insert_beds(cursor, ward_rows)
                doctors = insert_doctors(cursor)
                patient_ids = insert_patients(cursor)
                insert_vitals(cursor, patient_ids)
                insert_symptoms(cursor, patient_ids)
                insert_queue_and_triage(cursor, patient_ids, doctors)
                admission_rows = assign_beds_and_admissions(cursor, beds, patient_ids, doctors)
                insert_discharge_orders(cursor, admission_rows)

        print("[ok] all seed data inserted successfully")
    except Exception as exc:
        connection.rollback()
        raise RuntimeError(f"Seeding failed: {exc}") from exc
    finally:
        connection.close()


if __name__ == "__main__":
    main()
