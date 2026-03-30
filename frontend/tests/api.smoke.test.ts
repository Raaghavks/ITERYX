import assert from "node:assert/strict";

import {
  confirmDischargeOrder,
  createAdmission,
  createDischargeOrder,
  getAllBeds,
  getQueue,
  preallocateBed,
  registerPatient,
} from "../lib/api.ts";

type MockResponseBody = Record<string, unknown>;

function createJsonResponse(body: MockResponseBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

await runCase("registerPatient performs register and triage journey", async () => {
  const calls: Array<{ url: string; body?: unknown }> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });

    if (url.endsWith("/patients/register")) {
      return createJsonResponse({ success: true, data: { patient_id: 41 }, message: "ok" });
    }
    if (url.endsWith("/triage/score")) {
      return createJsonResponse({
        success: true,
        data: { score: 95, priority_level: "CRITICAL", queue_position: 1 },
        message: "ok",
      });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const result = await registerPatient({
    name: "Asha",
    age: 32,
    gender: "female",
    doctor_id: 2,
    vitals: {
      heart_rate: 124,
      bp_systolic: 140,
      bp_diastolic: 95,
      temperature: 100.2,
      spo2: 87,
    },
    symptoms: [{ symptom: "breathing difficulty" }],
  });

  assert.equal(result.patient_id, 41);
  assert.equal(result.priority_level, "CRITICAL");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.endsWith("/patients/register"), true);
  assert.deepEqual(calls[1].body, { patient_id: 41, doctor_id: 2 });
});

await runCase("queue and bed payloads are mapped into frontend view models", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/queue/opd")) {
      return createJsonResponse({
        success: true,
        data: [
          {
            id: 7,
            patient_id: 21,
            name: "Ravi Kumar",
            age: 45,
            gender: "male",
            doctor_id: 2,
            doctor_name: "Dr. Mehta",
            chief_complaint: "chest pain",
            score: 73.5,
            priority_level: "HIGH",
            queue_position: 1,
            status: "waiting",
            created_at: "2026-03-31T10:00:00+00:00",
            wait_time_mins: 14,
          },
        ],
        message: "ok",
      });
    }
    if (url.endsWith("/beds")) {
      return createJsonResponse({
        success: true,
        data: {
          wards: [
            {
              ward_id: 3,
              ward_name: "General Ward",
              beds: [
                {
                  bed_id: 11,
                  bed_number: "GEN-011",
                  status: "occupied",
                  assigned_patient_id: 21,
                  patient_name: "Ravi Kumar",
                  doctor_id: 2,
                  assigned_doctor: "Dr. Mehta",
                },
              ],
            },
          ],
        },
        message: "ok",
      });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const queue = await getQueue();
  const beds = await getAllBeds();

  assert.equal(queue[0].doctor?.name, "Dr. Mehta");
  assert.equal(queue[0].triage?.priority_level, "HIGH");
  assert.equal(beds[0].patient_initials, "RK");
  assert.equal(beds[0].assigned_doctor, "Dr. Mehta");
});

await runCase("admission and discharge helpers call the expected API endpoints", async () => {
  const seen: string[] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    seen.push(`${init?.method ?? "GET"} ${url}`);

    if (url.endsWith("/beds/pre-allocate")) {
      return createJsonResponse({
        success: true,
        data: {
          bed_id: 8,
          bed_number: "ICU-008",
          ward_name: "ICU",
          ward_id: 1,
          patient_id: 12,
          status: "reserved",
        },
      });
    }
    if (url.endsWith("/admissions")) {
      return createJsonResponse({ success: true, data: { admission_id: 4 } }, 201);
    }
    if (url.endsWith("/discharge-orders") && init?.method === "POST") {
      return createJsonResponse({ success: true, data: { discharge_order_id: 6 } }, 201);
    }
    if (url.endsWith("/discharge-orders/6/confirm")) {
      return createJsonResponse({ success: true, data: { status: "completed" } });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const reservation = await preallocateBed(12, 1);
  await createAdmission(12, reservation.bed_id, 3);
  await createDischargeOrder(12, reservation.bed_id, 3, "2026-03-31T18:00:00.000Z");
  await confirmDischargeOrder(6, 3);

  assert.deepEqual(seen, [
    "POST http://localhost:8000/api/beds/pre-allocate",
    "POST http://localhost:8000/api/admissions",
    "POST http://localhost:8000/api/discharge-orders",
    "PATCH http://localhost:8000/api/discharge-orders/6/confirm",
  ]);
});
