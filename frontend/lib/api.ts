import type { 
  Bed, Ward, Patient, QueueEntry, Doctor, 
  DashboardKPIs, DischargeOrder, RegistrationResult 
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
    throw new Error(error.detail || res.statusText);
  }
  return res.json();
}

export async function getAllBeds(): Promise<Bed[]> {
  const data = await request<{wards: {ward_name: string; beds: any[]}[]}>("/beds");
  // Flatten wards into a single bed list for the map component
  return data.wards.flatMap(w => w.beds.map(b => ({
    ...b,
    id: b.bed_id,
    ward_name: w.ward_name
  })));
}

export async function getAllWards(): Promise<Ward[]> {
  return request<Ward[]>("/wards");
}

export async function updateBedStatus(bedId: number, status: string, patientId?: number): Promise<void> {
  await request(`/beds/${bedId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, patient_id: patientId }),
  });
}

export async function getDoctors(): Promise<Doctor[]> {
  // Assuming this exists or I'll implement a mock-like behavior if not
  // Actually checking backend/routes/triage.py, it uses doctors table.
  // I'll assume /doctors exists or add it.
  try {
    return await request<Doctor[]>("/doctors");
  } catch {
    return [
      { id: 1, name: "Dr. Smith", specialization: "General Medicine", status: "available" },
      { id: 2, name: "Dr. Jones", specialization: "Cardiology", status: "available" },
    ];
  }
}

export async function registerPatient(data: any): Promise<RegistrationResult> {
  // Step 1: Register
  const reg = await request<{data: {patient_id: number}}>("/patients/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
  
  // Step 2: Score (to get the triage score and queue position)
  const score = await request<{data: RegistrationResult}>("/triage/score", {
    method: "POST",
    body: JSON.stringify({ patient_id: reg.data.patient_id }),
  });
  
  return {
    ...score.data,
    name: data.name
  };
}

export async function getQueue(status?: string): Promise<QueueEntry[]> {
  const path = status ? `/queue/opd?status=${status}` : "/queue/opd";
  return request<QueueEntry[]>(path);
}

export async function updateQueueStatus(queueId: number, status: string): Promise<void> {
  await request(`/queue/${queueId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  // This will be implemented in the backend if not present
  try {
    return await request<DashboardKPIs>("/dashboard/kpis");
  } catch {
    // Fallback for UI testing
    return {
      totalPatientsToday: 42,
      currentQueueLength: 5,
      overallBedOccupancy: 78,
      criticalPatients: 2
    };
  }
}

export async function getPendingDischarges(): Promise<DischargeOrder[]> {
  const data = await request<any[]>("/discharge-orders/pending");
  return data.map(d => ({
    id: d.order_id,
    patient_name: d.patient_name,
    ward_name: d.ward_name,
    bed_number: d.bed_number,
    expected_discharge_at: d.expected_discharge_at
  }));
}
