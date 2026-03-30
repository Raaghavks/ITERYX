# 📋 API CONTRACT — Smart Hospital Triage & Bed Management

> **Single Source of Truth for Frontend ↔ Backend Communication**
>
> Both backend (M1, M2) and frontend (M3, M4) teams **MUST** follow this contract exactly.
> This enables fully independent, parallel development.

---

## Table of Contents

1. [Base Configuration](#base-configuration)
2. [REST API Endpoints](#rest-api-endpoints)
   - [Patient Registration](#1-patient-registration)
   - [Triage Scoring](#2-triage-scoring)
   - [OPD Queue](#3-opd-queue)
   - [Queue Status Update](#4-queue-status-update)
   - [Get Beds](#5-get-beds)
   - [Get Wards](#6-get-wards)
   - [Bed Status Update](#7-bed-status-update)
   - [Bed Pre-Allocation](#8-bed-pre-allocation)
   - [Predict Bed Vacancy](#9-predict-bed-vacancy)
   - [Create Admission](#10-create-admission)
   - [Create Discharge Order](#11-create-discharge-order)
   - [Pending Discharge Orders](#12-pending-discharge-orders)
3. [Socket.IO Events](#socketio-real-time-events)
4. [Common Data Models](#common-data-models)
5. [Error Response Format](#error-response-format)
6. [Status Codes](#status-codes)

---

## Base Configuration

| Key             | Value                          |
|-----------------|--------------------------------|
| Base URL        | `http://localhost:5000/api`     |
| Socket.IO URL   | `http://localhost:5000`         |
| Content-Type    | `application/json`             |
| Protocol        | HTTP/1.1                       |
| Socket.IO Path  | `/socket.io`                   |

---

## REST API Endpoints

---

### 1. Patient Registration

```
Endpoint : POST /api/patients/register
Owner    : M1
```

**Request Body:**

```json
{
  "name": "Ravi Kumar",
  "age": 45,
  "gender": "Male",
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

**Field Definitions:**

| Field                    | Type     | Required | Constraints                                     |
|--------------------------|----------|----------|--------------------------------------------------|
| `name`                   | string   | ✅       | 1–100 characters                                 |
| `age`                    | integer  | ✅       | 0–150                                            |
| `gender`                 | string   | ✅       | One of: `"Male"`, `"Female"`, `"Other"`          |
| `contact`                | string   | ✅       | 10-digit numeric string                          |
| `vitals.bp_systolic`     | integer  | ✅       | 50–300 mmHg                                      |
| `vitals.bp_diastolic`    | integer  | ✅       | 30–200 mmHg                                      |
| `vitals.spo2`            | integer  | ✅       | 0–100 (percentage)                               |
| `vitals.temperature`     | float    | ✅       | 90.0–110.0 °F                                    |
| `vitals.heart_rate`      | integer  | ✅       | 20–250 bpm                                       |
| `symptoms`               | array    | ✅       | At least 1 item                                  |
| `symptoms[].symptom_text`| string   | ✅       | 1–255 characters                                 |
| `symptoms[].severity_code`| integer | ✅       | 1 (mild) – 5 (life-threatening)                  |

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "patient_id": 1
  },
  "message": "Patient registered successfully"
}
```

**Error Response (400 Bad Request):**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "contact", "message": "Contact must be a 10-digit number" }
  ]
}
```

---

### 2. Triage Scoring

```
Endpoint : POST /api/triage/score
Owner    : M1
```

**Description:** Calculates a triage priority score for a registered patient based on their vitals, symptoms, and age. Returns the priority level and auto-assigns them to the OPD queue.

**Request Body:**

```json
{
  "patient_id": 1
}
```

**Field Definitions:**

| Field        | Type    | Required | Constraints                        |
|--------------|---------|----------|------------------------------------|
| `patient_id` | integer | ✅       | Must reference an existing patient |

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "triage_id": 1,
    "patient_id": 1,
    "score": 72.5,
    "priority": "HIGH",
    "priority_label": "Urgent — Immediate OPD",
    "queue_id": 5,
    "assessed_at": "2025-06-15T10:30:00Z"
  },
  "message": "Triage score calculated"
}
```

**Priority Mapping:**

| Score Range | Priority     | Label                          |
|-------------|-------------|--------------------------------|
| 80–100      | `CRITICAL`  | Life-Threatening — Emergency   |
| 60–79       | `HIGH`      | Urgent — Immediate OPD        |
| 40–59       | `MODERATE`  | Semi-Urgent — Standard OPD    |
| 0–39        | `LOW`       | Non-Urgent — General Queue    |

**Error Response (404 Not Found):**

```json
{
  "success": false,
  "error": "Patient not found",
  "details": []
}
```

---

### 3. OPD Queue

```
Endpoint : GET /api/queue/opd
Owner    : M1
```

**Description:** Returns the full OPD queue sorted by triage priority (highest first), then by arrival time (earliest first).

**Query Parameters:**

| Parameter | Type   | Required | Default | Description                                               |
|-----------|--------|----------|---------|-----------------------------------------------------------|
| `status`  | string | ❌       | all     | Filter by status: `waiting`, `in_consultation`, `completed`|

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "queue": [
      {
        "queue_id": 5,
        "patient_id": 1,
        "patient_name": "Ravi Kumar",
        "age": 45,
        "gender": "Male",
        "triage_score": 72.5,
        "priority": "HIGH",
        "status": "waiting",
        "position": 1,
        "entered_queue_at": "2025-06-15T10:30:00Z",
        "estimated_wait_minutes": 10
      },
      {
        "queue_id": 3,
        "patient_id": 2,
        "patient_name": "Priya Sharma",
        "age": 30,
        "gender": "Female",
        "triage_score": 45.0,
        "priority": "MODERATE",
        "status": "waiting",
        "position": 2,
        "entered_queue_at": "2025-06-15T10:20:00Z",
        "estimated_wait_minutes": 25
      }
    ],
    "total_count": 2
  },
  "message": "OPD queue retrieved"
}
```

---

### 4. Queue Status Update

```
Endpoint : PATCH /api/queue/{queue_id}/status
Owner    : M1
```

**Description:** Updates the status of a patient in the OPD queue (e.g., mark as in consultation or completed).

**Path Parameters:**

| Parameter  | Type    | Required | Description          |
|------------|---------|----------|----------------------|
| `queue_id` | integer | ✅       | ID of the queue entry|

**Request Body:**

```json
{
  "status": "in_consultation"
}
```

**Field Definitions:**

| Field    | Type   | Required | Constraints                                           |
|----------|--------|----------|-------------------------------------------------------|
| `status` | string | ✅       | One of: `"waiting"`, `"in_consultation"`, `"completed"` |

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "queue_id": 5,
    "patient_id": 1,
    "previous_status": "waiting",
    "new_status": "in_consultation",
    "updated_at": "2025-06-15T10:45:00Z"
  },
  "message": "Queue status updated"
}
```

**Error Response (404 Not Found):**

```json
{
  "success": false,
  "error": "Queue entry not found",
  "details": []
}
```

---

### 5. Get Beds

```
Endpoint : GET /api/beds
Owner    : M2
```

**Description:** Returns all beds across all wards with their current status.

**Query Parameters:**

| Parameter | Type    | Required | Default | Description                                        |
|-----------|---------|----------|---------|----------------------------------------------------|
| `ward_id` | integer | ❌       | all     | Filter beds by ward                                |
| `status`  | string  | ❌       | all     | Filter by status: `available`, `occupied`, `reserved`, `maintenance` |

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "beds": [
      {
        "bed_id": 1,
        "bed_number": "ICU-001",
        "ward_id": 1,
        "ward_name": "ICU",
        "status": "available",
        "patient_id": null,
        "patient_name": null,
        "admitted_at": null
      },
      {
        "bed_id": 2,
        "bed_number": "ICU-002",
        "ward_id": 1,
        "ward_name": "ICU",
        "status": "occupied",
        "patient_id": 3,
        "patient_name": "Amit Patel",
        "admitted_at": "2025-06-14T08:00:00Z"
      }
    ],
    "summary": {
      "total": 50,
      "available": 18,
      "occupied": 25,
      "reserved": 5,
      "maintenance": 2
    }
  },
  "message": "Beds retrieved"
}
```

---

### 6. Get Wards

```
Endpoint : GET /api/wards
Owner    : M2
```

**Description:** Returns all wards with their bed capacity and current occupancy statistics.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "wards": [
      {
        "ward_id": 1,
        "ward_name": "ICU",
        "total_beds": 10,
        "available_beds": 3,
        "occupied_beds": 5,
        "reserved_beds": 1,
        "maintenance_beds": 1,
        "occupancy_rate": 50.0
      },
      {
        "ward_id": 2,
        "ward_name": "General Ward",
        "total_beds": 30,
        "available_beds": 12,
        "occupied_beds": 15,
        "reserved_beds": 2,
        "maintenance_beds": 1,
        "occupancy_rate": 50.0
      },
      {
        "ward_id": 3,
        "ward_name": "Emergency",
        "total_beds": 10,
        "available_beds": 3,
        "occupied_beds": 5,
        "reserved_beds": 2,
        "maintenance_beds": 0,
        "occupancy_rate": 50.0
      }
    ]
  },
  "message": "Wards retrieved"
}
```

---

### 7. Bed Status Update

```
Endpoint : PATCH /api/beds/{bed_id}/status
Owner    : M2
```

**Description:** Updates the status of a specific bed (e.g., mark as available after cleaning, or put under maintenance).

**Path Parameters:**

| Parameter | Type    | Required | Description    |
|-----------|---------|----------|----------------|
| `bed_id`  | integer | ✅       | ID of the bed  |

**Request Body:**

```json
{
  "status": "maintenance",
  "reason": "Sanitization in progress"
}
```

**Field Definitions:**

| Field    | Type   | Required | Constraints                                                      |
|----------|--------|----------|------------------------------------------------------------------|
| `status` | string | ✅       | One of: `"available"`, `"occupied"`, `"reserved"`, `"maintenance"` |
| `reason` | string | ❌       | Optional note (max 255 chars). Required when status = `maintenance`|

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "bed_id": 1,
    "bed_number": "ICU-001",
    "ward_id": 1,
    "previous_status": "available",
    "new_status": "maintenance",
    "reason": "Sanitization in progress",
    "updated_at": "2025-06-15T11:00:00Z"
  },
  "message": "Bed status updated"
}
```

**Error Response (404 Not Found):**

```json
{
  "success": false,
  "error": "Bed not found",
  "details": []
}
```

**Error Response (409 Conflict):**

```json
{
  "success": false,
  "error": "Cannot change status of an occupied bed without discharge",
  "details": []
}
```

---

### 8. Bed Pre-Allocation

```
Endpoint : POST /api/beds/pre-allocate
Owner    : M2
```

**Description:** Pre-allocates (reserves) a bed for a patient based on triage priority. The system intelligently selects the best available bed in the appropriate ward.

**Request Body:**

```json
{
  "patient_id": 1,
  "preferred_ward_id": 1
}
```

**Field Definitions:**

| Field               | Type    | Required | Constraints                        |
|---------------------|---------|----------|------------------------------------|
| `patient_id`        | integer | ✅       | Must reference an existing patient |
| `preferred_ward_id` | integer | ❌       | Preferred ward; system may override based on availability |

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "allocation_id": 1,
    "patient_id": 1,
    "patient_name": "Ravi Kumar",
    "bed_id": 3,
    "bed_number": "ICU-003",
    "ward_id": 1,
    "ward_name": "ICU",
    "status": "reserved",
    "reserved_at": "2025-06-15T11:05:00Z",
    "expires_at": "2025-06-15T12:05:00Z"
  },
  "message": "Bed pre-allocated successfully"
}
```

**Error Response (409 Conflict):**

```json
{
  "success": false,
  "error": "No available beds in the requested ward",
  "details": [
    { "ward_id": 1, "ward_name": "ICU", "available_beds": 0 }
  ]
}
```

---

### 9. Predict Bed Vacancy

```
Endpoint : GET /api/beds/predict-vacancy
Owner    : M2
```

**Description:** Returns AI/ML-predicted bed vacancy times for each ward based on current occupancy, historical discharge patterns, and patient conditions.

**Query Parameters:**

| Parameter | Type    | Required | Default | Description                   |
|-----------|---------|----------|---------|-------------------------------|
| `ward_id` | integer | ❌       | all     | Filter predictions by ward    |

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "predictions": [
      {
        "ward_id": 1,
        "ward_name": "ICU",
        "current_occupancy": 7,
        "total_beds": 10,
        "predicted_vacancies_next_6h": 2,
        "predicted_vacancies_next_12h": 4,
        "predicted_vacancies_next_24h": 5,
        "confidence_score": 0.85,
        "next_likely_vacancy_at": "2025-06-15T16:00:00Z"
      },
      {
        "ward_id": 2,
        "ward_name": "General Ward",
        "current_occupancy": 18,
        "total_beds": 30,
        "predicted_vacancies_next_6h": 5,
        "predicted_vacancies_next_12h": 8,
        "predicted_vacancies_next_24h": 12,
        "confidence_score": 0.91,
        "next_likely_vacancy_at": "2025-06-15T14:30:00Z"
      }
    ],
    "generated_at": "2025-06-15T11:10:00Z",
    "model_version": "1.0.0"
  },
  "message": "Vacancy predictions retrieved"
}
```

---

### 10. Create Admission

```
Endpoint : POST /api/admissions
Owner    : M2
```

**Description:** Formally admits a patient to a bed. Typically called after pre-allocation, converting a `reserved` bed to `occupied`.

**Request Body:**

```json
{
  "patient_id": 1,
  "bed_id": 3,
  "admitting_doctor": "Dr. Anand Mehta",
  "diagnosis": "Acute respiratory distress",
  "notes": "Patient requires O2 support"
}
```

**Field Definitions:**

| Field              | Type    | Required | Constraints                        |
|--------------------|---------|----------|------------------------------------|
| `patient_id`       | integer | ✅       | Must reference an existing patient |
| `bed_id`           | integer | ✅       | Must be `available` or `reserved`  |
| `admitting_doctor` | string  | ✅       | 1–100 characters                   |
| `diagnosis`        | string  | ✅       | 1–500 characters                   |
| `notes`            | string  | ❌       | Max 1000 characters                |

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "admission_id": 1,
    "patient_id": 1,
    "patient_name": "Ravi Kumar",
    "bed_id": 3,
    "bed_number": "ICU-003",
    "ward_id": 1,
    "ward_name": "ICU",
    "admitting_doctor": "Dr. Anand Mehta",
    "diagnosis": "Acute respiratory distress",
    "admitted_at": "2025-06-15T11:15:00Z",
    "status": "admitted"
  },
  "message": "Patient admitted successfully"
}
```

**Error Response (409 Conflict):**

```json
{
  "success": false,
  "error": "Bed is not available for admission",
  "details": [
    { "bed_id": 3, "current_status": "occupied" }
  ]
}
```

---

### 11. Create Discharge Order

```
Endpoint : POST /api/discharge-orders
Owner    : M2
```

**Description:** Creates a discharge order for an admitted patient. The bed remains occupied until the discharge is finalized.

**Request Body:**

```json
{
  "admission_id": 1,
  "discharge_reason": "Patient recovered",
  "discharge_notes": "Vitals stable. Follow-up in 7 days.",
  "ordered_by": "Dr. Anand Mehta"
}
```

**Field Definitions:**

| Field              | Type    | Required | Constraints                            |
|--------------------|---------|----------|----------------------------------------|
| `admission_id`     | integer | ✅       | Must reference an active admission     |
| `discharge_reason` | string  | ✅       | 1–255 characters                       |
| `discharge_notes`  | string  | ❌       | Max 1000 characters                    |
| `ordered_by`       | string  | ✅       | 1–100 characters                       |

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "discharge_order_id": 1,
    "admission_id": 1,
    "patient_id": 1,
    "patient_name": "Ravi Kumar",
    "bed_id": 3,
    "bed_number": "ICU-003",
    "ward_id": 1,
    "discharge_reason": "Patient recovered",
    "status": "pending",
    "ordered_at": "2025-06-16T09:00:00Z",
    "ordered_by": "Dr. Anand Mehta"
  },
  "message": "Discharge order created"
}
```

**Error Response (404 Not Found):**

```json
{
  "success": false,
  "error": "Active admission not found",
  "details": []
}
```

---

### 12. Pending Discharge Orders

```
Endpoint : GET /api/discharge-orders/pending
Owner    : M2
```

**Description:** Returns all pending (not yet finalized) discharge orders. Used by staff to process discharges and free up beds.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "pending_orders": [
      {
        "discharge_order_id": 1,
        "admission_id": 1,
        "patient_id": 1,
        "patient_name": "Ravi Kumar",
        "age": 45,
        "bed_id": 3,
        "bed_number": "ICU-003",
        "ward_id": 1,
        "ward_name": "ICU",
        "discharge_reason": "Patient recovered",
        "discharge_notes": "Vitals stable. Follow-up in 7 days.",
        "status": "pending",
        "ordered_at": "2025-06-16T09:00:00Z",
        "ordered_by": "Dr. Anand Mehta",
        "admitted_at": "2025-06-15T11:15:00Z"
      }
    ],
    "total_count": 1
  },
  "message": "Pending discharge orders retrieved"
}
```

---

## Socket.IO Real-Time Events

All events use the default namespace `/`.

### Events Table

| Event Name          | Direction              | Payload                                                                 | Fired When                    |
|---------------------|------------------------|-------------------------------------------------------------------------|-------------------------------|
| `queue_update`      | server → all clients   | `{ queue: OPDQueueItem[] }`                                             | Any queue change              |
| `bed_status_update` | server → all clients   | `{ bed_id, ward_id, new_status }`                                       | Any bed status change         |
| `emergency_alert`   | server → all clients   | `{ patient_name, priority, score, timestamp }`                          | CRITICAL triage assigned      |
| `connection_ack`    | server → one client    | `{ message: string }`                                                   | On connect                    |

---

### Event Payload Details

#### `queue_update`

Emitted whenever the OPD queue changes (new patient added, status changed, patient removed).

```json
{
  "queue": [
    {
      "queue_id": 5,
      "patient_id": 1,
      "patient_name": "Ravi Kumar",
      "age": 45,
      "gender": "Male",
      "triage_score": 72.5,
      "priority": "HIGH",
      "status": "waiting",
      "position": 1,
      "entered_queue_at": "2025-06-15T10:30:00Z",
      "estimated_wait_minutes": 10
    }
  ]
}
```

---

#### `bed_status_update`

Emitted whenever a bed's status changes (admission, discharge, maintenance toggle, reservation).

```json
{
  "bed_id": 3,
  "bed_number": "ICU-003",
  "ward_id": 1,
  "ward_name": "ICU",
  "new_status": "occupied",
  "previous_status": "reserved",
  "patient_id": 1,
  "patient_name": "Ravi Kumar",
  "updated_at": "2025-06-15T11:15:00Z"
}
```

---

#### `emergency_alert`

Emitted when a patient is triaged with `CRITICAL` priority (score ≥ 80).

```json
{
  "patient_id": 7,
  "patient_name": "Sunita Devi",
  "priority": "CRITICAL",
  "score": 92.0,
  "triage_id": 12,
  "timestamp": "2025-06-15T12:00:00Z"
}
```

---

#### `connection_ack`

Sent to a single client immediately after successful Socket.IO connection.

```json
{
  "message": "Connected to Smart Hospital real-time service"
}
```

---

## Common Data Models

### OPDQueueItem

```typescript
interface OPDQueueItem {
  queue_id: number;
  patient_id: number;
  patient_name: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  triage_score: number;
  priority: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  status: "waiting" | "in_consultation" | "completed";
  position: number;
  entered_queue_at: string;          // ISO 8601
  estimated_wait_minutes: number;
}
```

### Bed

```typescript
interface Bed {
  bed_id: number;
  bed_number: string;
  ward_id: number;
  ward_name: string;
  status: "available" | "occupied" | "reserved" | "maintenance";
  patient_id: number | null;
  patient_name: string | null;
  admitted_at: string | null;        // ISO 8601
}
```

### Ward

```typescript
interface Ward {
  ward_id: number;
  ward_name: string;
  total_beds: number;
  available_beds: number;
  occupied_beds: number;
  reserved_beds: number;
  maintenance_beds: number;
  occupancy_rate: number;            // 0.0 – 100.0
}
```

### TriageResult

```typescript
interface TriageResult {
  triage_id: number;
  patient_id: number;
  score: number;                     // 0.0 – 100.0
  priority: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  priority_label: string;
  queue_id: number;
  assessed_at: string;               // ISO 8601
}
```

---

## Error Response Format

All error responses follow this consistent structure:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": [
    {
      "field": "field_name",
      "message": "Specific validation message"
    }
  ]
}
```

> `details` is always an array. It may be empty (`[]`) for non-validation errors.

---

## Status Codes

| Code | Meaning              | Used When                                          |
|------|----------------------|----------------------------------------------------|
| 200  | OK                   | Successful GET or PATCH                            |
| 201  | Created              | Successful POST that creates a resource            |
| 400  | Bad Request          | Validation error in request body/params            |
| 404  | Not Found            | Referenced resource does not exist                 |
| 409  | Conflict             | Action conflicts with current state (e.g., bed occupied) |
| 500  | Internal Server Error| Unexpected server-side failure                     |

---

## Versioning & Change Log

| Date       | Version | Change Description        | Author |
|------------|---------|---------------------------|--------|
| 2025-06-15 | 1.0.0   | Initial API contract      | Team   |

---

> ⚠️ **Important:** Any changes to this contract must be discussed and agreed upon by all teams (M1, M2, M3, M4) before being merged into `main`.
