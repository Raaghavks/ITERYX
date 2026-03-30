'use client';

import { useEffect, useState } from 'react';
import { socketService } from '@/lib/socket';
import { api } from '@/lib/api';
import { PriorityLevel } from '@/types/index';
import { AlertTriangle, Clock, Users, Zap, Play, Hospital } from 'lucide-react';

interface QueueItem {
  patient_id: number;
  name: string;
  age: number;
  chief_complaint: string;
  score: number;
  priority_level: PriorityLevel;
  queue_position: number;
  wait_time_mins: number;
}

interface WardPrediction {
  ward_id: number;
  ward_name: string;
  predicted_free_beds: number;
  current_available: number;
}

interface Stats {
  totalWaiting: number;
  critical: number;
  highPriority: number;
  avgWait: number;
}

export default function DoctorQueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<Stats>({ totalWaiting: 0, critical: 0, highPriority: 0, avgWait: 0 });
  const [loading, setLoading] = useState(true);
  const [admitModal, setAdmitModal] = useState<{ open: boolean; patient?: QueueItem }>({ open: false });
  const [wardPredictions, setWardPredictions] = useState<WardPrediction[]>([]);
  const [selectedWard, setSelectedWard] = useState<number | null>(null);
  const [admitting, setAdmitting] = useState(false);
  const [emergencyBanner, setEmergencyBanner] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  const fetchQueue = async () => {
    try {
      const data = await api.getOPDQueue();
      setQueue(data);

      // Calculate stats
      const totalWaiting = data.length;
      const critical = data.filter(item => item.priority_level === PriorityLevel.CRITICAL).length;
      const highPriority = data.filter(item => item.priority_level === PriorityLevel.HIGH).length;
      const avgWait = data.length > 0 ? Math.round(data.reduce((sum, item) => sum + item.wait_time_mins, 0) / data.length) : 0;

      setStats({ totalWaiting, critical, highPriority, avgWait });
    } catch (error) {
      console.error('Failed to fetch queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartConsultation = async (patientId: number) => {
    try {
      await api.updateQueueStatus(patientId.toString(), 'in_consultation');
      // Queue will be updated via socket
    } catch (error) {
      console.error('Failed to start consultation:', error);
    }
  };

  const handleAdmitPatient = async (patient: QueueItem) => {
    setAdmitModal({ open: true, patient });
    try {
      const predictions = await api.predictVacancy();
      setWardPredictions(predictions);
    } catch (error) {
      console.error('Failed to fetch ward predictions:', error);
    }
  };

  const handleReserveBed = async () => {
    if (!selectedWard || !admitModal.patient) return;

    setAdmitting(true);
    try {
      const result = await api.preallocateBed({
        patient_id: admitModal.patient.patient_id,
        ward_id: selectedWard,
      });

      // Create admission
      await api.createAdmission({
        patient_id: admitModal.patient.patient_id,
        bed_id: result.bed_id,
        doctor_id: 1, // Assuming current doctor ID
      });

      setAdmitModal({ open: false });
      // Queue will be updated via socket
    } catch (error) {
      console.error('Failed to reserve bed:', error);
    } finally {
      setAdmitting(false);
    }
  };

  const getPriorityColor = (priority: PriorityLevel) => {
    switch (priority) {
      case PriorityLevel.CRITICAL: return 'border-red-500 bg-red-50';
      case PriorityLevel.HIGH: return 'border-orange-500 bg-orange-50';
      case PriorityLevel.MEDIUM: return 'border-yellow-500 bg-yellow-50';
      case PriorityLevel.LOW: return 'border-green-500 bg-green-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getPriorityBadge = (priority: PriorityLevel) => {
    const colors = {
      [PriorityLevel.CRITICAL]: 'bg-red-100 text-red-800',
      [PriorityLevel.HIGH]: 'bg-orange-100 text-orange-800',
      [PriorityLevel.MEDIUM]: 'bg-yellow-100 text-yellow-800',
      [PriorityLevel.LOW]: 'bg-green-100 text-green-800',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  useEffect(() => {
    fetchQueue();

    socketService.onQueueUpdate(() => {
      fetchQueue();
    });

    socketService.onEmergencyAlert((data: unknown) => {
      const emergencyData = data as { name: string; score: number };
      setEmergencyBanner({
        show: true,
        message: `🚨 CRITICAL PATIENT: ${emergencyData.name} — Score: ${emergencyData.score} — Moved to top`,
      });
      setTimeout(() => setEmergencyBanner({ show: false, message: '' }), 5000);
    });

    return () => {
      socketService.removeListener('queue_update');
      socketService.removeListener('emergency_alert');
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Emergency Banner */}
      {emergencyBanner.show && (
        <div className="bg-red-600 text-white px-4 py-3 text-center font-semibold animate-pulse">
          {emergencyBanner.message}
        </div>
      )}

      {/* Stats Bar */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Total Waiting</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalWaiting}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Critical</p>
                <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Zap className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">High Priority</p>
                <p className="text-2xl font-bold text-orange-600">{stats.highPriority}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Clock className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Avg Wait</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgWait} mins</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Queue */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Patient Queue</h1>

        <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
          {queue.map((patient) => (
            <div
              key={patient.patient_id}
              className={`border-l-4 p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow ${getPriorityColor(patient.priority_level)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-lg font-bold text-gray-500">#{patient.queue_position}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{patient.name}</h3>
                    <p className="text-sm text-gray-600">{patient.age} years • {patient.chief_complaint}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className="w-16 bg-gray-200 rounded-full h-2 mb-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min(patient.score, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">{patient.score}</span>
                  </div>

                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadge(patient.priority_level)}`}>
                    {patient.priority_level}
                  </span>

                  <span className="text-sm text-gray-600">Waiting {patient.wait_time_mins} mins</span>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleStartConsultation(patient.patient_id)}
                      className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Start
                    </button>
                    <button
                      onClick={() => handleAdmitPatient(patient)}
                      className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      <Hospital className="h-4 w-4 mr-1" />
                      Admit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Admit Modal */}
      {admitModal.open && admitModal.patient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Admit Patient: {admitModal.patient.name}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Ward</label>
                <div className="space-y-2">
                  {wardPredictions.map((ward) => (
                    <label key={ward.ward_id} className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="ward"
                        value={ward.ward_id}
                        checked={selectedWard === ward.ward_id}
                        onChange={() => setSelectedWard(ward.ward_id)}
                        className="text-blue-600"
                      />
                      <div>
                        <div className="font-medium">{ward.ward_name}</div>
                        <div className="text-sm text-gray-600">
                          Available: {ward.current_available} • Predicted free in 2hrs: {ward.predicted_free_beds}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setAdmitModal({ open: false })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReserveBed}
                  disabled={!selectedWard || admitting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {admitting ? 'Reserving...' : 'Reserve Bed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}