const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function fetchWrapper<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  registerPatient: (data: unknown) => 
    fetchWrapper('/patients/register', { method: 'POST', body: JSON.stringify(data) }),
    
  getTriageScore: (patient_id: string) => 
    fetchWrapper('/triage/score', { method: 'POST', body: JSON.stringify({ patient_id }) }),
    
  getOPDQueue: () => 
    fetchWrapper('/queue/opd', { method: 'GET' }),
    
  updateQueueStatus: (id: string, status: string) => 
    fetchWrapper(`/queue/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    
  getAllBeds: () => 
    fetchWrapper('/beds', { method: 'GET' }),
    
  getAllWards: () => 
    fetchWrapper('/wards', { method: 'GET' }),
    
  preallocateBed: (data: unknown) => 
    fetchWrapper('/beds/pre-allocate', { method: 'POST', body: JSON.stringify(data) }),
    
  predictVacancy: () => 
    fetchWrapper('/beds/predict-vacancy', { method: 'GET' }),
    
  createAdmission: (data: unknown) => 
    fetchWrapper('/admissions', { method: 'POST', body: JSON.stringify(data) }),
};
