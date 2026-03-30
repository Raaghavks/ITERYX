import type {
  Bed,
  DashboardKPIs,
  DischargeOrder,
  Doctor,
  PreallocateResult,
  QueueEntry,
  RegistrationResult,
  Ward,
  WardPrediction,
} from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || error.message || res.statusText);
  }

  return res.json();
}

function initialsFromName(name?: string | null): string | undefined {
  if (!name) return undefined;
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 3);
}

type BedsResponse = {
  wards: Array<{
    ward_id: number;
    ward_name: string;
    beds: Array<{
      bed_id: number;
      bed_number: string;
      status: Bed["status"];
      assigned_patient_id?: number | null;
      patient_name?: string | null;
    }>;
  }>;
};

export async function getAllBeds(): Promise<Bed[]> {
  const data = await request<BedsResponse>("/beds");

  return data.wards.flatMap((ward) =>
    ward.beds.map((bed) => ({
      id: bed.bed_id,
      number: bed.bed_number,
      bed_number: bed.bed_number,
      status: bed.status,
      ward_id: ward.ward_id,
      ward_name: ward.ward_name,
      assigned_patient_id: bed.assigned_patient_id ?? null,
      patient_name: bed.patient_name ?? null,
      patient_initials: initialsFromName(bed.patient_name),
    }))
  );
}

export async function getAllWards(): Promise<Ward[]> {
  const wards = await request<
    Array<{
      id: number;
      name: string;
      floor?: string;
      total_beds?: number;
      available_count?: number;
      occupied_count?: number;
      reserved_count?: number;
      maintenance_count?: number;
      occupancy_rate?: number;
    }>
  >("/wards");

  return wards.map((ward) => ({
    id: ward.id,
    name: ward.name,
    floor: ward.floor,
    location: ward.floor,
    total_beds: ward.total_beds,
    available_count: ward.available_count,
    occupied_count: ward.occupied_count,
    reserved_count: ward.reserved_count,
    maintenance_count: ward.maintenance_count,
    occupancy_rate: ward.occupancy_rate,
  }));
}

export async function updateBedStatus(bedId: number, status: string, patientId?: number): Promise<void> {
  await request(`/beds/${bedId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, patient_id: patientId }),
  });
}

export async function getDoctors(): Promise<Doctor[]> {
  return request<Doctor[]>("/doctors");
}

export async function registerPatient(data: {
  name: string;
  age: number;
  gender: string;
  contact?: string;
  doctor_id: number;
  vitals: {
    heart_rate: number;
    bp_systolic: number;
    bp_diastolic: number;
    temperature: number;
    spo2: number;
    respiratory_rate?: number;
  };
  symptoms: Array<{ symptom: string }>;
}): Promise<RegistrationResult> {
  const reg = await request<{ data: { patient_id: number } }>("/patients/register", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      age: data.age,
      gender: data.gender,
      contact: data.contact ?? "",
      vitals: {
        bp_systolic: data.vitals.bp_systolic,
        bp_diastolic: data.vitals.bp_diastolic,
        spo2: data.vitals.spo2,
        temperature: data.vitals.temperature,
        heart_rate: data.vitals.heart_rate,
      },
      symptoms: data.symptoms.map((symptom) => ({
        symptom_text: symptom.symptom,
        severity_code: 3,
      })),
    }),
  });

  const score = await request<{
    data: {
      score: number;
      priority_level: RegistrationResult["priority_level"];
      queue_position: number;
    };
  }>("/triage/score", {
    method: "POST",
    body: JSON.stringify({ patient_id: reg.data.patient_id }),
  });

  return {
    patient_id: reg.data.patient_id,
    name: data.name,
    triage_score: score.data.score,
    priority_level: score.data.priority_level,
    queue_position: score.data.queue_position,
  };
}

type QueueApiItem = {
  id: number;
  patient_id: number;
  name: string;
  age: number;
  gender?: string;
  doctor_id?: number;
  doctor_name?: string;
  chief_complaint: string;
  score: number;
  priority_level: QueueEntry["priority_level"];
  queue_position: number;
  status: QueueEntry["status"];
  created_at: string;
  wait_time_mins: number;
};

export async function getQueue(status?: string): Promise<QueueEntry[]> {
  const path = status ? `/queue/opd?status=${status}` : "/queue/opd";
  const data = await request<QueueApiItem[]>(path);

  return data.map((entry) => ({
    id: entry.id,
    patient_id: entry.patient_id,
    name: entry.name,
    age: entry.age,
    gender: entry.gender,
    chief_complaint: entry.chief_complaint,
    score: entry.score,
    priority_level: entry.priority_level,
    queue_position: entry.queue_position,
    status: entry.status,
    created_at: entry.created_at,
    wait_time_mins: entry.wait_time_mins,
    patient: {
      id: entry.patient_id,
      name: entry.name,
      age: entry.age,
      gender: entry.gender ?? "unknown",
    },
    doctor: entry.doctor_id
      ? {
          id: entry.doctor_id,
          name: entry.doctor_name ?? "Assigned Doctor",
        }
      : undefined,
    triage: {
      score: entry.score,
      priority_level: entry.priority_level,
      queue_position: entry.queue_position,
    },
  }));
}

export async function updateQueueStatus(queueId: number, status: string): Promise<void> {
  await request(`/queue/${queueId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  return request<DashboardKPIs>("/dashboard/kpis");
}

export async function getPendingDischarges(): Promise<DischargeOrder[]> {
  const data = await request<
    Array<{
      order_id: number;
      patient_name: string;
      ward_name: string;
      bed_number: string;
      expected_discharge_at: string;
    }>
  >("/discharge-orders/pending");

  return data.map((discharge) => ({
    id: discharge.order_id,
    patient_name: discharge.patient_name,
    ward_name: discharge.ward_name,
    bed_number: discharge.bed_number,
    expected_discharge_at: discharge.expected_discharge_at,
  }));
}

export async function getWardPredictions(): Promise<WardPrediction[]> {
  return request<WardPrediction[]>("/beds/predict-vacancy");
}

export async function preallocateBed(patientId: number, wardId?: number): Promise<PreallocateResult> {
  const result = await request<PreallocateResult>("/beds/pre-allocate", {
    method: "POST",
    body: JSON.stringify({ patient_id: patientId, ward_id: wardId }),
  });

  return result;
}

export async function createAdmission(patientId: number, bedId: number, doctorId: number) {
  return request("/admissions", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientId,
      bed_id: bedId,
      doctor_id: doctorId,
    }),
  });
}
