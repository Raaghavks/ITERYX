export type BedStatus = "available" | "occupied" | "reserved" | "maintenance";
export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Ward {
  id: number;
  name: string;
  location?: string;
  floor?: string;
  total_beds?: number;
  available_count?: number;
  occupied_count?: number;
  reserved_count?: number;
  maintenance_count?: number;
  occupancy_rate?: number;
}

export interface Bed {
  id: number;
  number: string;
  bed_number: string;
  status: BedStatus;
  ward_id: number;
  ward_name?: string;
  assigned_patient_id?: number | null;
  patient_name?: string | null;
  patient_initials?: string;
  admitted_since?: string;
  assigned_doctor?: string;
  doctor_id?: number | null;
}

export interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
  contact?: string;
  registered_at?: string;
}

export interface Vitals {
  heart_rate: number;
  bp_systolic: number;
  bp_diastolic: number;
  temperature: number;
  spo2: number;
  respiratory_rate?: number;
}

export interface Symptom {
  symptom: string;
  symptom_text?: string;
  severity_code?: number;
}

export interface RegistrationResult {
  patient_id: number;
  name: string;
  triage_score: number;
  priority_level: Priority;
  queue_position: number;
}

export interface QueueEntry {
  id: number;
  patient_id: number;
  name: string;
  age: number;
  gender?: string;
  chief_complaint: string;
  score: number;
  priority_level: Priority;
  queue_position: number;
  wait_time_mins: number;
  created_at: string;
  patient?: Patient;
  doctor?: {
    id: number;
    name: string;
  };
  triage?: {
    score: number;
    priority_level: Priority;
    queue_position: number;
  };
  status: "waiting" | "in_consultation" | "completed";
}

export interface Doctor {
  id: number;
  name: string;
  specialization: string;
  status: "available" | "busy";
}

export interface DashboardKPIs {
  totalPatientsToday: number;
  currentQueueLength: number;
  overallBedOccupancy: number;
  criticalPatients: number;
}

export interface DischargeOrder {
  id: number;
  patient_id: number;
  bed_id: number | null;
  doctor_id: number;
  patient_name: string;
  ward_name: string;
  bed_number: string;
  expected_discharge_at: string;
  confirmed_at?: string | null;
}

export interface EmergencyAlert {
  id: string;
  patient_name: string;
  timestamp: string;
  score: number;
  priority: Priority;
}

export interface EmergencyAlertPayload {
  patient_name: string;
  timestamp: string;
  score: number;
  priority: Priority;
}

export interface QueueUpdatePayload {
  totalPatientsToday?: number;
  currentQueueLength?: number;
  criticalPatients?: number;
}

export interface BedStatusUpdateEvent {
  bed_id: number;
  new_status: BedStatus;
  ward_id: number;
}

export interface DischargeOrderUpdateEvent {
  event: "created" | "confirmed";
  order_id: number;
  patient_id: number;
  bed_id?: number | null;
}

export interface WardOccupancyChartDatum {
  name: string;
  Available: number;
  Occupied: number;
  Reserved: number;
}

export interface TriageScore {
  score: number;
  priority_level: Priority;
}

// Additional interfaces for queue management
export interface QueueItem {
  patient_id: number;
  name: string;
  age: number;
  chief_complaint: string;
  score: number;
  priority_level: Priority;
  queue_position: number;
  wait_time_mins: number;
}

export interface WardPrediction {
  ward_id: number;
  ward_name: string;
  predicted_free_beds: number;
  current_available: number;
}

export interface QueueStats {
  totalWaiting: number;
  critical: number;
  highPriority: number;
  avgWait: number;
}

export interface PreallocateResult {
  bed_id: number;
  bed_number: string;
  ward_name: string;
  ward_id: number;
}

export interface RegisterPatientResult {
  success: boolean;
  data: { patient_id: number };
  message: string;
}

export interface TriageScoreResult {
  success: boolean;
  data: {
    score: number;
    priority_level: Priority;
    queue_position: number;
  };
  message: string;
}
