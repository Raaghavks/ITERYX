'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { PriorityLevel } from '@/types/index';
import { Heart, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface PatientForm {
  name: string;
  age: number;
  gender: string;
  contact: string;
  vitals: {
    bp_systolic: number;
    bp_diastolic: number;
    spo2: number;
    temperature: number;
    heart_rate: number;
  };
  symptoms: Array<{
    symptom_text: string;
    severity_code: number;
  }>;
}

interface TriageResult {
  score: number;
  priority_level: PriorityLevel;
  queue_position: number;
}

const SYMPTOMS_LIST = [
  "Chest Pain", "Breathing Difficulty", "Fever", "Headache",
  "Asthma Attack", "Vomiting", "Dizziness", "Abdominal Pain",
  "Fracture", "Unconscious", "Seizure", "Chest Tightness"
];

const SEVERITY_OPTIONS = [
  { label: 'Mild', value: 1 },
  { label: 'Moderate', value: 2 },
  { label: 'Severe', value: 3 },
  { label: 'Critical', value: 4 }
];

export default function OPDRegisterPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<PatientForm>({
    name: '',
    age: 0,
    gender: '',
    contact: '',
    vitals: {
      bp_systolic: 120,
      bp_diastolic: 80,
      spo2: 98,
      temperature: 98.6,
      heart_rate: 72,
    },
    symptoms: [],
  });
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [symptomSeverities, setSymptomSeverities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);

  const getVitalIndicator = (field: keyof PatientForm['vitals']) => {
    const value = formData.vitals[field];
    if (field === 'spo2' && value < 90) return { color: 'text-red-600', text: '⚠️ Critical' };
    if (field === 'heart_rate' && value > 120) return { color: 'text-red-600', text: '⚠️ Critical' };
    return { color: 'text-green-600', text: 'Normal' };
  };

  const handleSymptomToggle = (symptom: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Prepare symptoms data
      const symptoms = selectedSymptoms.map(symptom => ({
        symptom_text: symptom.toLowerCase(),
        severity_code: symptomSeverities[symptom] || 1,
      }));

      const patientData = {
        ...formData,
        symptoms,
      };

      // Register patient
      const registerResponse = await api.registerPatient(patientData);
      const patientId = registerResponse.data.patient_id;

      // Get triage score
      const scoreResponse = await api.getTriageScore(patientId.toString());

      setResult({
        score: scoreResponse.data.score,
        priority_level: scoreResponse.data.priority_level,
        queue_position: scoreResponse.data.queue_position,
      });
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setFormData({
      name: '',
      age: 0,
      gender: '',
      contact: '',
      vitals: {
        bp_systolic: 120,
        bp_diastolic: 80,
        spo2: 98,
        temperature: 98.6,
        heart_rate: 72,
      },
      symptoms: [],
    });
    setSelectedSymptoms([]);
    setSymptomSeverities({});
    setResult(null);
  };

  const getResultCardStyle = () => {
    if (!result) return '';
    switch (result.priority_level) {
      case PriorityLevel.CRITICAL:
        return 'border-red-500 bg-red-50 animate-pulse';
      case PriorityLevel.HIGH:
        return 'border-orange-500 bg-orange-50';
      case PriorityLevel.MEDIUM:
        return 'border-yellow-500 bg-yellow-50';
      case PriorityLevel.LOW:
        return 'border-green-500 bg-green-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const getPriorityIcon = () => {
    if (!result) return null;
    switch (result.priority_level) {
      case PriorityLevel.CRITICAL:
        return <AlertTriangle className="h-6 w-6 text-red-600" />;
      case PriorityLevel.HIGH:
        return <AlertTriangle className="h-6 w-6 text-orange-600" />;
      default:
        return <CheckCircle className="h-6 w-6 text-green-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Registration Form */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Patient Registration</h1>

            {!result ? (
              <>
                {/* Step Indicator */}
                <div className="flex items-center mb-8">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        currentStep >= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {step}
                      </div>
                      {step < 3 && (
                        <div className={`w-12 h-0.5 ${currentStep > step ? 'bg-blue-600' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Step 1: Patient Info */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900">Patient Information</h2>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter full name"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                        <input
                          type="number"
                          value={formData.age || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Age"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                        <select
                          value={formData.gender}
                          onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                      <input
                        type="tel"
                        value={formData.contact}
                        onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Phone number"
                      />
                    </div>

                    <button
                      onClick={() => setCurrentStep(2)}
                      disabled={!formData.name || !formData.age || !formData.gender || !formData.contact}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next: Vitals
                    </button>
                  </div>
                )}

                {/* Step 2: Vitals */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900">Vital Signs</h2>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">BP Systolic (mmHg)</label>
                        <input
                          type="number"
                          value={formData.vitals.bp_systolic}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            vitals: { ...prev.vitals, bp_systolic: parseInt(e.target.value) || 0 }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">BP Diastolic (mmHg)</label>
                        <input
                          type="number"
                          value={formData.vitals.bp_diastolic}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            vitals: { ...prev.vitals, bp_diastolic: parseInt(e.target.value) || 0 }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SpO2 %</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="50"
                            max="100"
                            value={formData.vitals.spo2}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              vitals: { ...prev.vitals, spo2: parseInt(e.target.value) || 0 }
                            }))}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className={`text-sm ${getVitalIndicator('spo2').color}`}>
                            {getVitalIndicator('spo2').text}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Temperature °F</label>
                        <input
                          type="number"
                          step="0.1"
                          min="95"
                          max="106"
                          value={formData.vitals.temperature}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            vitals: { ...prev.vitals, temperature: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Heart Rate (bpm)</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={formData.vitals.heart_rate}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            vitals: { ...prev.vitals, heart_rate: parseInt(e.target.value) || 0 }
                          }))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className={`text-sm ${getVitalIndicator('heart_rate').color}`}>
                          {getVitalIndicator('heart_rate').text}
                        </span>
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setCurrentStep(3)}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
                      >
                        Next: Symptoms
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Symptoms */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900">Symptoms</h2>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Symptoms</label>
                      <div className="grid grid-cols-2 gap-2">
                        {SYMPTOMS_LIST.map((symptom) => (
                          <div key={symptom} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={symptom}
                              checked={selectedSymptoms.includes(symptom)}
                              onChange={() => handleSymptomToggle(symptom)}
                              className="rounded"
                            />
                            <label htmlFor={symptom} className="text-sm cursor-pointer">
                              {symptom}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedSymptoms.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Severity for Selected Symptoms</label>
                        <div className="space-y-2">
                          {selectedSymptoms.map((symptom) => (
                            <div key={symptom} className="flex items-center space-x-2">
                              <span className="text-sm flex-1">{symptom}</span>
                              <select
                                value={symptomSeverities[symptom] || 1}
                                onChange={(e) => setSymptomSeverities(prev => ({
                                  ...prev,
                                  [symptom]: parseInt(e.target.value)
                                }))}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                {SEVERITY_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Additional Symptoms (Optional)</label>
                      <textarea
                        placeholder="Describe any other symptoms..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                      />
                    </div>

                    <div className="flex space-x-4">
                      <button
                        onClick={() => setCurrentStep(2)}
                        className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={loading || selectedSymptoms.length === 0}
                        className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <div className="flex items-center justify-center">
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            Processing...
                          </div>
                        ) : (
                          'Register Patient & Get Queue Number'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Patient Registered Successfully!</h2>
                <button
                  onClick={resetForm}
                  className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
                >
                  Register Another Patient
                </button>
              </div>
            )}
          </div>

          {/* Right Panel - Result Card */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            {result ? (
              <div className={`border-2 p-6 rounded-lg text-center ${getResultCardStyle()}`}>
                <div className="flex items-center justify-center mb-4">
                  {getPriorityIcon()}
                  <span className="ml-2 text-lg font-semibold">
                    {result.priority_level}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="text-4xl font-bold text-gray-900 mb-2">{result.score}</div>
                  <div className="text-sm text-gray-600">Urgency Score</div>
                </div>

                <div className="space-y-2 text-sm">
                  <div>Queue Position: <span className="font-semibold">#{result.queue_position}</span></div>
                  <div>Estimated Wait: <span className="font-semibold">~{Math.ceil(result.queue_position * 5)} minutes</span></div>
                </div>

                {result.priority_level === PriorityLevel.CRITICAL && (
                  <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-md">
                    <AlertTriangle className="h-5 w-5 text-red-600 inline mr-2" />
                    Moved to top of queue immediately
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-16">
                <Heart className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Complete the registration form to see triage results</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}