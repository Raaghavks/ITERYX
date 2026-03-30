"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDoctors, registerPatient } from "@/lib/api";
import type { Doctor, Priority, RegistrationResult } from "@/types";
import { Activity, AlertTriangle, CheckCircle, User } from "lucide-react";

const SYMPTOMS = [
  "chest pain",
  "breathing difficulty",
  "fever",
  "headache",
  "fracture",
  "asthma attack",
  "vomiting",
  "dizziness",
  "abdominal pain",
  "unconscious",
  "chest tightness",
  "seizure",
];

const PRIORITY_COLORS: Record<Priority, string> = {
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-500 text-white",
  MEDIUM: "bg-yellow-400 text-slate-900",
  LOW: "bg-emerald-500 text-white",
};

export default function OPDRegisterPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "male",
    contact: "",
    doctor_id: "",
    heart_rate: "",
    bp_systolic: "",
    bp_diastolic: "",
    temperature: "",
    spo2: "",
    respiratory_rate: "",
    symptoms: [] as string[],
  });

  useEffect(() => {
    getDoctors()
      .then((data) => {
        setDoctors(data);
        setDoctorsError(null);
      })
      .catch((loadError) => {
        console.error(loadError);
        setDoctorsError(
          loadError instanceof Error ? loadError.message : "Unable to load doctors."
        );
      });
  }, []);

  function toggleSymptom(symptom: string) {
    setForm((current) => ({
      ...current,
      symptoms: current.symptoms.includes(symptom)
        ? current.symptoms.filter((item) => item !== symptom)
        : [...current.symptoms, symptom],
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const data = await registerPatient({
        name: form.name,
        age: Number.parseInt(form.age, 10),
        gender: form.gender,
        contact: form.contact || undefined,
        doctor_id: Number.parseInt(form.doctor_id, 10),
        vitals: {
          heart_rate: Number.parseInt(form.heart_rate, 10),
          bp_systolic: Number.parseInt(form.bp_systolic, 10),
          bp_diastolic: Number.parseInt(form.bp_diastolic, 10),
          temperature: Number.parseFloat(form.temperature),
          spo2: Number.parseInt(form.spo2, 10),
          respiratory_rate: form.respiratory_rate
            ? Number.parseInt(form.respiratory_rate, 10)
            : undefined,
        },
        symptoms: form.symptoms.map((symptom) => ({ symptom })),
      });
      setResult(data);
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setForm({
      name: "",
      age: "",
      gender: "male",
      contact: "",
      doctor_id: "",
      heart_rate: "",
      bp_systolic: "",
      bp_diastolic: "",
      temperature: "",
      spo2: "",
      respiratory_rate: "",
      symptoms: [],
    });
  }

  const inputClassName =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-400";
  const labelClassName =
    "mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500";

  return (
    <section className="space-y-6">
      {result ? (
        <div className="mx-auto max-w-lg rounded-3xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="mb-1 text-2xl font-bold text-slate-800">
            Registration Complete
          </h2>
          <p className="mb-8 text-sm text-slate-500">
            Patient successfully registered and added to the queue.
          </p>

          <div className="mb-8 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-left">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Patient
              </p>
              <p className="font-bold text-slate-800">{result.name}</p>
              <p className="text-xs text-slate-500">ID #{result.patient_id}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-left">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Queue Position
              </p>
              <p className="text-3xl font-black text-indigo-600">
                #{result.queue_position}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-left">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Triage Score
              </p>
              <p className="text-3xl font-black text-slate-800">
                {result.triage_score}
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Priority
              </p>
              <span
                className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold ${PRIORITY_COLORS[result.priority_level]}`}
              >
                {result.priority_level}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              Register Another
            </button>
            <Link
              href="/doctor/queue"
              className="flex-1 rounded-xl bg-indigo-50 py-3 text-center text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              View Queue →
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
              <User className="h-5 w-5 text-slate-400" />
              <h2 className="font-bold text-slate-700">Patient Details</h2>
            </div>

            <div>
              <label className={labelClassName}>Full Name *</label>
              <input
                required
                className={inputClassName}
                placeholder="e.g. Arun Kumar"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClassName}>Age *</label>
                <input
                  required
                  type="number"
                  min={0}
                  max={150}
                  className={inputClassName}
                  placeholder="e.g. 34"
                  value={form.age}
                  onChange={(event) => setForm({ ...form, age: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClassName}>Gender *</label>
                <select
                  required
                  className={inputClassName}
                  value={form.gender}
                  onChange={(event) => setForm({ ...form, gender: event.target.value })}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClassName}>Contact (optional)</label>
              <input
                className={inputClassName}
                placeholder="+91 XXXXXXXXXX"
                value={form.contact}
                onChange={(event) => setForm({ ...form, contact: event.target.value })}
              />
            </div>

            <div>
              <label className={labelClassName}>Assign Doctor *</label>
              <select
                required
                className={inputClassName}
                value={form.doctor_id}
                onChange={(event) => setForm({ ...form, doctor_id: event.target.value })}
              >
                <option value="">Select a doctor...</option>
                {doctors
                  .filter((doctor) => doctor.status === "available")
                  .map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} · {doctor.specialization}
                    </option>
                  ))}
              </select>
            </div>

            {doctorsError && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {doctorsError}
              </div>
            )}

            <div>
              <label className={labelClassName}>Symptoms *</label>
              <div className="flex flex-wrap gap-2">
                {SYMPTOMS.map((symptom) => (
                  <button
                    type="button"
                    key={symptom}
                    onClick={() => toggleSymptom(symptom)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                      form.symptoms.includes(symptom)
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"
                    }`}
                  >
                    {symptom}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
              <Activity className="h-5 w-5 text-slate-400" />
              <h2 className="font-bold text-slate-700">Vitals</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClassName}>Heart Rate (bpm) *</label>
                <input
                  required
                  type="number"
                  className={inputClassName}
                  placeholder="72"
                  value={form.heart_rate}
                  onChange={(event) => setForm({ ...form, heart_rate: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClassName}>SpO2 (%) *</label>
                <input
                  required
                  type="number"
                  min={0}
                  max={100}
                  className={inputClassName}
                  placeholder="98"
                  value={form.spo2}
                  onChange={(event) => setForm({ ...form, spo2: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClassName}>BP Systolic (mmHg) *</label>
                <input
                  required
                  type="number"
                  className={inputClassName}
                  placeholder="120"
                  value={form.bp_systolic}
                  onChange={(event) => setForm({ ...form, bp_systolic: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClassName}>BP Diastolic (mmHg) *</label>
                <input
                  required
                  type="number"
                  className={inputClassName}
                  placeholder="80"
                  value={form.bp_diastolic}
                  onChange={(event) => setForm({ ...form, bp_diastolic: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClassName}>Temperature (°F) *</label>
                <input
                  required
                  type="number"
                  step="0.1"
                  className={inputClassName}
                  placeholder="98.6"
                  value={form.temperature}
                  onChange={(event) => setForm({ ...form, temperature: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClassName}>Respiratory Rate</label>
                <input
                  type="number"
                  className={inputClassName}
                  placeholder="16 (optional)"
                  value={form.respiratory_rate}
                  onChange={(event) => setForm({ ...form, respiratory_rate: event.target.value })}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Normal Ranges
              </p>
              <div className="grid grid-cols-2 gap-1 text-xs text-slate-500">
                <span>Heart rate: 60-100 bpm</span>
                <span>SpO2: 95% or higher</span>
                <span>Blood pressure: 90/60-120/80</span>
                <span>Temperature: 97-99°F</span>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-500" />
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || form.symptoms.length === 0}
              className="w-full rounded-2xl bg-teal-600 py-4 text-base font-bold text-white shadow-lg shadow-teal-500/20 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Processing Triage..." : "Register & Compute Triage Score"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
