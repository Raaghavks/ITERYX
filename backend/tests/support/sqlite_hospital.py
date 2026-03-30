from __future__ import annotations

import re
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterator


sqlite3.register_adapter(datetime, lambda value: value.isoformat())
sqlite3.register_converter("timestamp", lambda value: datetime.fromisoformat(value.decode()))


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_row(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


class CursorWrapper:
    def __init__(self, cursor: sqlite3.Cursor):
        self.cursor = cursor

    def execute(self, query: str, params: tuple[Any, ...] | list[Any] | None = None) -> "CursorWrapper":
        normalized_query = self._prepare_query(query)
        self.cursor.execute(normalized_query, tuple(params or ()))
        return self

    def fetchone(self) -> dict[str, Any] | None:
        return normalize_row(self.cursor.fetchone())

    def fetchall(self) -> list[dict[str, Any]]:
        return [dict(row) for row in self.cursor.fetchall()]

    def _prepare_query(self, query: str) -> str:
        query = query.replace("%s", "?")
        query = re.sub(r"FOR UPDATE SKIP LOCKED", "", query, flags=re.IGNORECASE)
        query = re.sub(r"\bILIKE\b", "LIKE", query, flags=re.IGNORECASE)
        return query


@dataclass
class SqliteHospitalDB:
    connection: sqlite3.Connection

    @classmethod
    def create(cls) -> "SqliteHospitalDB":
        connection = sqlite3.connect(
            ":memory:",
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
            check_same_thread=False,
        )
        connection.row_factory = sqlite3.Row
        database = cls(connection=connection)
        database._create_schema()
        database._seed()
        return database

    def close(self) -> None:
        self.connection.close()

    @contextmanager
    def get_db(self) -> Iterator[CursorWrapper]:
        cursor = self.connection.cursor()
        wrapped = CursorWrapper(cursor)
        try:
            yield wrapped
            self.connection.commit()
        except Exception:
            self.connection.rollback()
            raise
        finally:
            cursor.close()

    def _create_schema(self) -> None:
        cursor = self.connection.cursor()
        cursor.executescript(
            """
            CREATE TABLE patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                gender TEXT NOT NULL,
                contact TEXT NOT NULL,
                registered_at timestamp NOT NULL
            );

            CREATE TABLE vitals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                bp_systolic INTEGER NOT NULL,
                bp_diastolic INTEGER NOT NULL,
                spo2 INTEGER NOT NULL,
                temperature REAL NOT NULL,
                heart_rate INTEGER NOT NULL,
                recorded_at timestamp NOT NULL
            );

            CREATE TABLE symptoms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                symptom_text TEXT NOT NULL,
                severity_code INTEGER NOT NULL
            );

            CREATE TABLE triage_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                score REAL NOT NULL,
                priority_level TEXT NOT NULL,
                queue_position INTEGER NOT NULL,
                computed_at timestamp NOT NULL
            );

            CREATE TABLE doctors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                specialization TEXT NOT NULL,
                is_available INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE opd_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                doctor_id INTEGER NOT NULL,
                queue_position INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_at timestamp NOT NULL
            );

            CREATE TABLE wards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                total_beds INTEGER NOT NULL,
                floor INTEGER NOT NULL
            );

            CREATE TABLE beds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ward_id INTEGER NOT NULL,
                bed_number TEXT NOT NULL,
                status TEXT NOT NULL,
                assigned_patient_id INTEGER NULL,
                last_updated timestamp NOT NULL
            );

            CREATE TABLE admissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                bed_id INTEGER NOT NULL,
                doctor_id INTEGER NOT NULL,
                admitted_at timestamp NOT NULL,
                discharged_at timestamp NULL
            );

            CREATE TABLE discharge_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                bed_id INTEGER NOT NULL,
                doctor_id INTEGER NOT NULL,
                expected_discharge_at timestamp NOT NULL,
                confirmed_at timestamp NULL
            );
            """
        )
        self.connection.commit()

    def _seed(self) -> None:
        now = utcnow()
        cursor = self.connection.cursor()
        cursor.executemany(
            """
            INSERT INTO doctors (name, specialization, is_available)
            VALUES (?, ?, ?)
            """,
            [
                ("Dr. Mehta", "General Medicine", 1),
                ("Dr. Sharma", "Emergency Medicine", 1),
                ("Dr. Busy", "Cardiology", 0),
            ],
        )
        cursor.executemany(
            """
            INSERT INTO wards (name, total_beds, floor)
            VALUES (?, ?, ?)
            """,
            [
                ("ICU", 2, 2),
                ("General Ward", 3, 1),
            ],
        )
        cursor.executemany(
            """
            INSERT INTO beds (ward_id, bed_number, status, assigned_patient_id, last_updated)
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                (1, "ICU-001", "AVAILABLE", None, now),
                (1, "ICU-002", "AVAILABLE", None, now),
                (2, "GEN-001", "AVAILABLE", None, now),
                (2, "GEN-002", "MAINTENANCE", None, now),
                (2, "GEN-003", "AVAILABLE", None, now),
            ],
        )
        self.connection.commit()
