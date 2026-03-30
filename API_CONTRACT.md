# API Contract

This document reflects the live API used by the current frontend and backend in this repository.

## Base Configuration

| Key | Value |
| --- | --- |
| Base URL | `http://localhost:8000/api` |
| Socket URL | `http://localhost:8000` |
| Socket Path | `/socket.io` |
| Content Type | `application/json` |

## Standard Response Envelope

Successful responses use this shape:

```json
{
  "success": true,
  "data": {},
  "message": "Human-readable success message"
}
```

Error responses use this shape:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": [
    {
      "field": "field_name",
      "message": "What failed"
    }
  ]
}
```

`details` may be an empty array for non-validation errors.

## REST Endpoints

### POST /api/patients/register

Registers a patient and stores the initial vitals and symptoms.

Request body:

```json
{
  "name": "Ravi Kumar",
  "age": 45,
  "gender": "male",
  "contact": "9876543210",
  "vitals": {
    "bp_systolic": 140,
    "bp_diastolic": 90,
    "spo2": 88,
    "temperature": 99.5,
    "heart_rate": 115
  },
  "symptoms": [
    {
      "symptom_text": "breathing difficulty",
      "severity_code": 3
    }
  ]
}
```

Response data:

```json
{
  "patient_id": 1
}
```

### POST /api/triage/score

Calculates triage score, assigns priority, and inserts or refreshes the OPD queue entry.

Request body:

```json
{
  "patient_id": 1,
  "doctor_id": 2
}
```

`doctor_id` is optional. If omitted, the backend assigns the first available doctor.

Response data:

```json
{
  "score": 72.5,
  "priority_level": "HIGH",
  "queue_position": 1,
  "doctor_id": 2
}
```

### GET /api/doctors

Returns doctors for the OPD intake flow.

Response data:

```json
[
  {
    "id": 1,
    "name": "Dr. Mehta",
    "specialization": "General Medicine",
    "status": "available"
  }
]
```

### GET /api/queue/opd?status=waiting

Returns OPD queue entries sorted by triage score descending, then queue time ascending.

Supported `status` values:
- `waiting`
- `in_consultation`
- `completed`

Response data:

```json
[
  {
    "id": 5,
    "patient_id": 1,
    "name": "Ravi Kumar",
    "age": 45,
    "gender": "male",
    "doctor_id": 2,
    "doctor_name": "Dr. Mehta",
    "chief_complaint": "breathing difficulty",
    "score": 72.5,
    "priority_level": "HIGH",
    "queue_position": 1,
    "status": "waiting",
    "created_at": "2026-03-31T10:30:00+00:00",
    "wait_time_mins": 10
  }
]
```

### PATCH /api/queue/{queue_id}/status

Updates OPD queue status.

Request body:

```json
{
  "status": "in_consultation"
}
```

Response data:

```json
{
  "queue_id": 5,
  "patient_id": 1,
  "previous_status": "waiting",
  "new_status": "in_consultation",
  "updated_at": "2026-03-31T10:45:00+00:00"
}
```

### GET /api/beds

Returns beds grouped by ward.

Optional query params:
- `ward_id`
- `status` where status is one of `available`, `occupied`, `reserved`, `maintenance`

Response data:

```json
{
  "wards": [
    {
      "ward_id": 1,
      "ward_name": "ICU",
      "beds": [
        {
          "bed_id": 1,
          "bed_number": "ICU-001",
          "status": "available",
          "assigned_patient_id": null,
          "patient_name": null
        }
      ]
    }
  ]
}
```

### GET /api/wards

Returns ward summaries with occupancy counts.

Response data:

```json
[
  {
    "id": 1,
    "name": "ICU",
    "floor": "Floor 1",
    "total_beds": 10,
    "available_count": 3,
    "occupied_count": 5,
    "reserved_count": 1,
    "maintenance_count": 1,
    "occupancy_rate": 50.0
  }
]
```

### PATCH /api/beds/{bed_id}/status

Updates bed status and assigned patient reference.

Request body:

```json
{
  "status": "maintenance",
  "patient_id": null
}
```

Response data:

```json
{
  "bed_id": 1,
  "ward_id": 1,
  "bed_number": "ICU-001",
  "previous_status": "available",
  "new_status": "maintenance",
  "assigned_patient_id": null,
  "patient_name": null,
  "updated_at": "2026-03-31T11:00:00+00:00"
}
```

### POST /api/beds/pre-allocate

Reserves the next available bed for a patient.

Request body:

```json
{
  "patient_id": 1,
  "ward_id": 1
}
```

`ward_id` is optional.

Response data:

```json
{
  "bed_id": 3,
  "bed_number": "ICU-003",
  "ward_name": "ICU",
  "ward_id": 1,
  "patient_id": 1,
  "status": "reserved"
}
```

### GET /api/beds/predict-vacancy

Returns vacancy predictions per ward.

Response data:

```json
[
  {
    "ward_id": 1,
    "ward_name": "ICU",
    "predicted_free_beds": 2,
    "current_available": 3
  }
]
```

### POST /api/admissions

Creates an admission, marks the bed as occupied, and completes any active OPD queue entry for the patient.

Request body:

```json
{
  "patient_id": 1,
  "bed_id": 3,
  "doctor_id": 2
}
```

Response data:

```json
{
  "admission_id": 10,
  "patient_id": 1,
  "patient_name": "Ravi Kumar",
  "bed_id": 3,
  "bed_number": "ICU-003",
  "ward_id": 1,
  "doctor_id": 2,
  "doctor_name": "Dr. Mehta",
  "admitted_at": "2026-03-31T11:15:00+00:00",
  "status": "admitted"
}
```

### POST /api/discharge-orders

Creates a pending discharge order.

Request body:

```json
{
  "patient_id": 1,
  "bed_id": 3,
  "doctor_id": 2,
  "expected_discharge_at": "2026-03-31T18:00:00+00:00"
}
```

Response data:

```json
{
  "discharge_order_id": 15,
  "patient_id": 1,
  "bed_id": 3,
  "doctor_id": 2,
  "expected_discharge_at": "2026-03-31T18:00:00+00:00",
  "confirmed_at": null
}
```

### GET /api/discharge-orders/pending

Returns all unconfirmed discharge orders.

Response data:

```json
[
  {
    "order_id": 15,
    "patient_id": 1,
    "patient_name": "Ravi Kumar",
    "bed_id": 3,
    "bed_number": "ICU-003",
    "ward_name": "ICU",
    "expected_discharge_at": "2026-03-31T18:00:00+00:00",
    "doctor_id": 2
  }
]
```

### PATCH /api/discharge-orders/{order_id}/confirm

Confirms a pending discharge order, marks the matching admission as discharged, and releases the bed back to `available`.

Request body:

```json
{
  "confirmed_by": 2
}
```

`confirmed_by` is optional and currently stored only in the response payload.

Response data:

```json
{
  "discharge_order_id": 15,
  "patient_id": 1,
  "patient_name": "Ravi Kumar",
  "bed_id": 3,
  "bed_number": "ICU-003",
  "confirmed_at": "2026-03-31T18:05:00+00:00",
  "status": "completed",
  "confirmed_by": 2
}
```

### GET /api/dashboard/kpis

Returns the admin dashboard KPI snapshot.

Response data:

```json
{
  "totalPatientsToday": 42,
  "currentQueueLength": 9,
  "overallBedOccupancy": 84,
  "criticalPatients": 2
}
```

### GET /health

Returns DB/Redis state plus lightweight monitoring counters.

Response data:

```json
{
  "db": "connected",
  "redis": "connected",
  "app_env": "development",
  "monitoring": {
    "uptime_seconds": 120,
    "total_requests": 34,
    "error_requests": 0,
    "last_request_at": "2026-03-31T12:15:00+00:00"
  }
}
```

### GET /livez

Returns a simple liveness probe for container/orchestrator checks.

### GET /readyz

Returns readiness state for database and Redis dependencies.

### GET /metrics

Returns plain-text Prometheus-style counters for uptime and request volume.

## Socket Events

### `queue_update`

Emitted when queue membership or status changes.

Current payload examples:

```json
{
  "event": "new_patient",
  "patient_id": 1
}
```

```json
{
  "event": "status_change",
  "queue_id": 5,
  "status": "completed"
}
```

### `bed_status_update`

Emitted when a bed changes state.

Current payload:

```json
{
  "bed_id": 3,
  "ward_id": 1,
  "new_status": "occupied",
  "patient_name": "Ravi Kumar"
}
```

### `emergency_alert`

Emitted when triage marks a patient as `CRITICAL`.

Current payload:

```json
{
  "patient_name": "Ravi Kumar",
  "priority": "CRITICAL",
  "score": 95.0,
  "timestamp": "2026-03-31T12:00:00+00:00"
}
```

### `discharge_order_update`

Emitted when a discharge order is created or confirmed.

Current payload:

```json
{
  "event": "confirmed",
  "order_id": 15,
  "patient_id": 1,
  "bed_id": 3
}
```
