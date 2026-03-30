export enum PriorityLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export interface Vitals {
  heartRate: number;
  bloodPressure: string;
  temperature: number;
  respiratoryRate: number;
  oxygenSaturation: number;
}

export interface Symptom {
  id: string;
  name: string;
  severity: number;
}

export interface TriageScore {
  score: number;
  priority: PriorityLevel;
  recommendedWard?: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  vitals: Vitals;
  symptoms: Symptom[];
  triageScore?: TriageScore;
  registeredAt: string;
}

export interface OPDQueueItem {
  id: string;
  patientId: string;
  roomNumber: string;
  queueNumber: number;
  status: 'WAITING' | 'WITH_DOCTOR' | 'COMPLETED';
  patient: Patient;
}

export interface Ward {
  id: string;
  name: string;
  capacity: number;
  occupied: number;
}

export interface Bed {
  id: string;
  wardId: string;
  isOccupied: boolean;
  patientId?: string;
  allocatedAt?: string;
}

export interface DischargeOrder {
  id: string;
  patientId: string;
  dischargedAt: string;
  instructions: string;
}

export interface Admission {
  id: string;
  patientId: string;
  bedId: string;
  admittedAt: string;
  status: 'ADMITTED' | 'DISCHARGED';
}

// Additional interfaces for queue management
export interface QueueItem {
  patient_id: number;
  name: string;
  age: number;
  chief_complaint: string;
  score: number;
  priority_level: PriorityLevel;
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
  bed_number: number;
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
    priority_level: PriorityLevel;
    queue_position: number;
  };
  message: string;
}
