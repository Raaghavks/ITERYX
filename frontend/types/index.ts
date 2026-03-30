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
