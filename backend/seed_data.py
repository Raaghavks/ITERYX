import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_values
from dotenv import load_dotenv


WARD_ROWS = [
    {"name": "General Ward", "location": "Floor 1", "bed_count": 20},
    {"name": "ICU", "location": "Floor 2", "bed_count": 10},
    {"name": "Pediatric Ward", "location": "Floor 1", "bed_count": 15},
    {"name": "Orthopedic Ward", "location": "Floor 3", "bed_count": 12},
    {"name": "Emergency Ward", "location": "Floor 0", "bed_count": 8},
]

DOCTOR_ROWS = [
    ("Dr. Arun Sharma", "General Physician", "available"),
    ("Dr. Priya Nair", "Cardiologist", "available"),
    ("Dr. Karan Mehta", "Pediatrician", "available"),
    ("Dr. Sneha Iyer", "Emergency Medicine", "available"),
    ("Dr. Raj Patel", "Orthopedic Surgeon", "unavailable"),
    ("Dr. Meera Krishnan", "General Physician", "available"),
    ("Dr. Vikram Das", "Pulmonologist", "available"),
    ("Dr. Anitha Rao", "Neurologist", "unavailable"),
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


def load_environment():
    backend_dir = Path(__file__).resolve().parent
    root_dir = backend_dir.parent
    load_dotenv(root_dir / ".env")
    load_dotenv(backend_dir / ".env")



def get_connection():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set. Add it to .env before running seed_data.py")

    return psycopg2.connect(database_url)



def truncate_all_tables(cursor):
    cursor.execute(
        """
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename;
        """
    )
    tables = [row[0] for row in cursor.fetchall()]

    if not tables:
        return

    query = sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE;").format(
        sql.SQL(", ").join(sql.Identifier("public", table) for table in tables)
    )
    cursor.execute(query)



def insert_wards(cursor):
    ward_payload = [(row["name"], row["location"], row["bed_count"]) for row in WARD_ROWS]
    execute_values(
        cursor,
        """
        INSERT INTO wards (name, location, bed_count)
        VALUES %s
        RETURNING id, bed_count;
        """,
        ward_payload,
    )
    wards = cursor.fetchall()
    print("✅ Wards inserted")
    return wards



def build_statuses(total):
    # Largest remainder allocation to keep totals exact.
    weighted = {
        "occupied": total * 0.60,
        "available": total * 0.25,
        "reserved": total * 0.10,
        "maintenance": total * 0.05,
    }

    base_counts = {k: int(v) for k, v in weighted.items()}
    assigned = sum(base_counts.values())
    remainder = total - assigned

    if remainder > 0:
        by_fraction = sorted(
            weighted.items(), key=lambda kv: (kv[1] - int(kv[1])), reverse=True
        )
        for idx in range(remainder):
            base_counts[by_fraction[idx][0]] += 1

    statuses = []
    for status, count in base_counts.items():
        statuses.extend([status] * count)

    random.shuffle(statuses)
    return statuses



def insert_beds(cursor, ward_rows):
    total_beds = sum(row[1] for row in ward_rows)
    statuses = build_statuses(total_beds)

    bed_rows = []
    bed_number = 1
    status_index = 0

    for ward_id, ward_bed_count in ward_rows:
        for _ in range(ward_bed_count):
            bed_rows.append(
                (
                    ward_id,
                    f"B{bed_number:03d}",
                    statuses[status_index],
                )
            )
            bed_number += 1
            status_index += 1

    execute_values(
        cursor,
        """
        INSERT INTO beds (ward_id, bed_number, status)
        VALUES %s;
        """,
        bed_rows,
    )
    print(f"✅ Beds inserted ({len(bed_rows)} total)")



def insert_doctors(cursor):
    execute_values(
        cursor,
        """
        INSERT INTO doctors (name, specialization, status)
        VALUES %s
        RETURNING id, status;
        """,
        DOCTOR_ROWS,
    )
    doctors = cursor.fetchall()
    print("✅ Doctors inserted")
    return doctors



def insert_patients(cursor):
    random.seed(42)
    ages = [5, 8, 11, 14, 17, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 52, 56, 60, 64, 68, 72, 76, 79, 82, 85]
    genders = ["male", "female", "male", "female", "male"]

    patient_rows = []
    for idx, name in enumerate(PATIENT_NAMES):
        patient_rows.append((name, ages[idx], genders[idx % len(genders)]))

    execute_values(
        cursor,
        """
        INSERT INTO patients (name, age, gender)
        VALUES %s
        RETURNING id;
        """,
        patient_rows,
    )
    patient_ids = [row[0] for row in cursor.fetchall()]
    print("✅ Patients inserted")
    return patient_ids



def insert_vitals(cursor, patient_ids):
    random.seed(43)
    shuffled = patient_ids[:]
    random.shuffle(shuffled)

    critical = shuffled[:5]
    moderate = shuffled[5:13]
    normal = shuffled[13:]

    vitals_rows = []

    for pid in critical:
        if random.random() < 0.5:
            spo2 = random.randint(82, 89)
            heart_rate = random.randint(95, 118)
        else:
            spo2 = random.randint(90, 95)
            heart_rate = random.randint(121, 145)

        vitals_rows.append(
            (
                pid,
                heart_rate,
                random.randint(100, 115),
                random.randint(65, 78),
                round(random.uniform(99.2, 102.1), 1),
                spo2,
                random.randint(20, 32),
            )
        )

    for pid in moderate:
        vitals_rows.append(
            (
                pid,
                random.randint(95, 118),
                random.randint(118, 138),
                random.randint(78, 89),
                round(random.uniform(98.8, 100.4), 1),
                random.randint(90, 94),
                random.randint(17, 22),
            )
        )

    for pid in normal:
        vitals_rows.append(
            (
                pid,
                random.randint(68, 96),
                random.randint(108, 126),
                random.randint(68, 82),
                round(random.uniform(97.7, 99.2), 1),
                random.randint(95, 100),
                random.randint(12, 18),
            )
        )

    execute_values(
        cursor,
        """
        INSERT INTO vitals (patient_id, heart_rate, bp_systolic, bp_diastolic, temperature, spo2, respiratory_rate)
        VALUES %s;
        """,
        vitals_rows,
    )
    print("✅ Vitals inserted")



def insert_symptoms(cursor, patient_ids):
    random.seed(44)
    symptom_rows = []

    for pid in patient_ids:
        count = random.randint(1, 3)
        picked = random.sample(SYMPTOM_POOL, count)
        for symptom in picked:
            symptom_rows.append((pid, symptom))

    execute_values(
        cursor,
        """
        INSERT INTO symptoms (patient_id, symptom)
        VALUES %s;
        """,
        symptom_rows,
    )
    print("✅ Symptoms inserted")



def insert_opd_queue(cursor, patient_ids, doctor_rows):
    random.seed(45)
    available_doctor_ids = [doctor_id for doctor_id, status in doctor_rows if status == "available"]
    selected_patients = random.sample(patient_ids, 15)

    queue_rows = []
    for idx, patient_id in enumerate(selected_patients):
        doctor_id = available_doctor_ids[idx % len(available_doctor_ids)]
        queue_rows.append((patient_id, doctor_id, "waiting"))

    execute_values(
        cursor,
        """
        INSERT INTO opd_queue (patient_id, doctor_id, status)
        VALUES %s;
        """,
        queue_rows,
    )
    print("✅ OPD Queue inserted")



def insert_discharge_orders(cursor, patient_ids, doctor_rows):
    random.seed(46)
    chosen_patients = random.sample(patient_ids, 3)
    doctor_ids = [doc[0] for doc in doctor_rows]
    now = datetime.now(timezone.utc)

    discharge_rows = []
    for patient_id in chosen_patients:
        expected_at = now + timedelta(minutes=random.randint(10, 120))
        doctor_id = random.choice(doctor_ids)
        discharge_rows.append((patient_id, doctor_id, expected_at))

    execute_values(
        cursor,
        """
        INSERT INTO discharge_orders (patient_id, doctor_id, expected_discharge_at)
        VALUES %s;
        """,
        discharge_rows,
    )
    print("✅ Discharge orders inserted")



def main():
    random.seed(7)
    load_environment()

    connection = get_connection()
    try:
        with connection:
            with connection.cursor() as cursor:
                truncate_all_tables(cursor)

                ward_rows = insert_wards(cursor)
                insert_beds(cursor, ward_rows)

                doctor_rows = insert_doctors(cursor)
                patient_ids = insert_patients(cursor)

                insert_vitals(cursor, patient_ids)
                insert_symptoms(cursor, patient_ids)
                insert_opd_queue(cursor, patient_ids, doctor_rows)
                insert_discharge_orders(cursor, patient_ids, doctor_rows)

        print("✅ All seed data inserted successfully.")
    except Exception as exc:
        connection.rollback()
        raise RuntimeError(f"Seeding failed: {exc}") from exc
    finally:
        connection.close()


if __name__ == "__main__":
    main()
