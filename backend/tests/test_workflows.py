from __future__ import annotations

import unittest
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient

from backend.api_contract import http_exception_handler, validation_exception_handler
from backend.routes import admissions, beds, triage
from backend.tests.support.sqlite_hospital import SqliteHospitalDB


class DummySocket:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict]] = []

    async def emit(self, event: str, payload: dict) -> None:
        self.events.append((event, payload))


async def async_noop(*args, **kwargs) -> None:
    return None


class WorkflowIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = SqliteHospitalDB.create()
        self.stack = ExitStack()
        self.socket = DummySocket()

        self.stack.enter_context(patch.object(triage, "get_db", self.db.get_db))
        self.stack.enter_context(patch.object(beds, "get_db", self.db.get_db))
        self.stack.enter_context(patch.object(admissions, "get_db", self.db.get_db))

        self.stack.enter_context(patch.object(triage, "sio", self.socket))
        self.stack.enter_context(patch.object(triage, "emit_emergency_alert", async_noop))
        self.stack.enter_context(patch.object(beds, "set_redis_json", async_noop))
        self.stack.enter_context(patch.object(beds, "emit_bed_update", async_noop))
        self.stack.enter_context(patch.object(admissions, "set_redis_json", async_noop))
        self.stack.enter_context(patch.object(admissions, "emit_bed_update", async_noop))
        self.stack.enter_context(patch.object(admissions, "emit_discharge_order_update", async_noop))

        app = FastAPI()
        app.add_exception_handler(HTTPException, http_exception_handler)
        app.add_exception_handler(RequestValidationError, validation_exception_handler)
        app.include_router(triage.router_patients)
        app.include_router(triage.router)
        app.include_router(triage.router_queue)
        app.include_router(beds.router)
        app.include_router(admissions.router)
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.stack.close()
        self.db.close()

    def register_and_score_patient(
        self,
        *,
        name: str,
        spo2: int,
        heart_rate: int,
        symptom_text: str,
        doctor_id: int = 1,
    ) -> dict:
        register_payload = {
            "name": name,
            "age": 47,
            "gender": "male",
            "contact": "9999999999",
            "vitals": {
                "bp_systolic": 132,
                "bp_diastolic": 86,
                "spo2": spo2,
                "temperature": 99.1,
                "heart_rate": heart_rate,
            },
            "symptoms": [
                {
                    "symptom_text": symptom_text,
                    "severity_code": 4,
                }
            ],
        }
        registered = self.client.post("/api/patients/register", json=register_payload)
        self.assertEqual(201, registered.status_code)
        patient_id = registered.json()["data"]["patient_id"]

        scored = self.client.post(
            "/api/triage/score",
            json={"patient_id": patient_id, "doctor_id": doctor_id},
        )
        self.assertEqual(200, scored.status_code)
        return {"patient_id": patient_id, "triage": scored.json()["data"]}

    def test_registration_triage_and_queue_sorting(self) -> None:
        mild = self.register_and_score_patient(
            name="Mild Case",
            spo2=98,
            heart_rate=82,
            symptom_text="fever",
        )
        critical = self.register_and_score_patient(
            name="Critical Case",
            spo2=86,
            heart_rate=126,
            symptom_text="breathing difficulty",
        )

        queue_response = self.client.get("/api/queue/opd?status=waiting")
        self.assertEqual(200, queue_response.status_code)
        queue = queue_response.json()["data"]

        self.assertEqual("Critical Case", queue[0]["name"])
        self.assertEqual("CRITICAL", critical["triage"]["priority_level"])
        self.assertGreater(critical["triage"]["score"], mild["triage"]["score"])
        self.assertEqual("waiting", queue[0]["status"])

    def test_queue_status_transition_is_filterable(self) -> None:
        flow = self.register_and_score_patient(
            name="Queue Patient",
            spo2=95,
            heart_rate=88,
            symptom_text="headache",
        )

        queue_response = self.client.get("/api/queue/opd?status=waiting")
        queue_entry = next(item for item in queue_response.json()["data"] if item["patient_id"] == flow["patient_id"])

        updated = self.client.patch(
            f"/api/queue/{queue_entry['id']}/status",
            json={"status": "in_consultation"},
        )
        self.assertEqual(200, updated.status_code)
        self.assertEqual("in_consultation", updated.json()["data"]["new_status"])

        filtered = self.client.get("/api/queue/opd?status=in_consultation")
        self.assertEqual(200, filtered.status_code)
        patient_ids = [item["patient_id"] for item in filtered.json()["data"]]
        self.assertIn(flow["patient_id"], patient_ids)

    def test_bed_reservation_admission_and_discharge_cycle(self) -> None:
        flow = self.register_and_score_patient(
            name="Admission Patient",
            spo2=92,
            heart_rate=110,
            symptom_text="chest pain",
        )

        preallocated = self.client.post(
            "/api/beds/pre-allocate",
            json={"patient_id": flow["patient_id"], "ward_id": 1},
        )
        self.assertEqual(200, preallocated.status_code)
        reserved_bed = preallocated.json()["data"]
        self.assertEqual("reserved", reserved_bed["status"])

        admitted = self.client.post(
            "/api/admissions",
            json={"patient_id": flow["patient_id"], "bed_id": reserved_bed["bed_id"], "doctor_id": 1},
        )
        self.assertEqual(201, admitted.status_code)
        self.assertEqual("admitted", admitted.json()["data"]["status"])

        queue_after_admission = self.client.get("/api/queue/opd?status=completed")
        completed_ids = [item["patient_id"] for item in queue_after_admission.json()["data"]]
        self.assertIn(flow["patient_id"], completed_ids)

        discharge_at = (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat()
        order = self.client.post(
            "/api/discharge-orders",
            json={
                "patient_id": flow["patient_id"],
                "bed_id": reserved_bed["bed_id"],
                "doctor_id": 1,
                "expected_discharge_at": discharge_at,
            },
        )
        self.assertEqual(201, order.status_code)
        order_id = order.json()["data"]["discharge_order_id"]

        pending = self.client.get("/api/discharge-orders/pending")
        self.assertEqual(200, pending.status_code)
        pending_ids = [item["order_id"] for item in pending.json()["data"]]
        self.assertIn(order_id, pending_ids)

        confirmed = self.client.patch(
            f"/api/discharge-orders/{order_id}/confirm",
            json={"confirmed_by": 1},
        )
        self.assertEqual(200, confirmed.status_code)
        self.assertEqual("completed", confirmed.json()["data"]["status"])

        available_beds = self.client.get("/api/beds?status=available")
        self.assertEqual(200, available_beds.status_code)
        released = [
            bed
            for ward in available_beds.json()["data"]["wards"]
            for bed in ward["beds"]
            if bed["bed_id"] == reserved_bed["bed_id"]
        ]
        self.assertTrue(released)
        self.assertEqual("available", released[0]["status"])

    def test_manual_bed_status_update_assigns_patient(self) -> None:
        flow = self.register_and_score_patient(
            name="Bed Mapping Patient",
            spo2=97,
            heart_rate=80,
            symptom_text="vomiting",
        )

        updated = self.client.patch(
            "/api/beds/3/status",
            json={"status": "reserved", "patient_id": flow["patient_id"]},
        )
        self.assertEqual(200, updated.status_code)
        payload = updated.json()["data"]
        self.assertEqual("available", payload["previous_status"])
        self.assertEqual("reserved", payload["new_status"])
        self.assertEqual(flow["patient_id"], payload["assigned_patient_id"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
