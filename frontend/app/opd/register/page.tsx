"use client";

import { useEffect, useState } from "react";
import { getDoctors, registerPatient } from "@/lib/api";
import type { Doctor, RegistrationResult, Priority } from "@/types";
import { CheckCircle, AlertTriangle, Activity, User, Stethoscope } from "lucide-react";
import Link from "next/link";

const SYMPTOMS = [
  "chest pain", "breathing difficulty", "fever", "headache", "fracture",
  "asthma attack", "vomiting", "dizziness", "abdominal pain", "unconscious",
  "chest tightness", "seizure",
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

  const [form, setForm] = useState({
    name: "", age: "", gender: "male", contact: "", doctor_id: "",
    heart_rate: "", bp_systolic: "", bp_diastolic: "",
    temperature: "", spo2: "", respiratory_rate: "",
    symptoms: [] as string[],
  });

  useEffect(() => {
    getDoctors().then(setDoctors).catch(console.error);
  }, []);

  function toggleSymptom(s: string) {
    setForm((f) => ({
      ...f,
      symptoms: f.symptoms.includes(s) ? f.symptoms.filter((x) => x !== s) : [...f.symptoms, s],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const data = await registerPatient({
        name: form.name,
        age: parseInt(form.age),
        gender: form.gender,
        contact: form.contact || undefined,
        doctor_id: parseInt(form.doctor_id),
        vitals: {
          heart_rate: parseInt(form.heart_rate),
          bp_systolic: parseInt(form.bp_systolic),
          bp_diastolic: parseInt(form.bp_diastolic),
          temperature: parseFloat(form.temperature),
          spo2: parseInt(form.spo2),
          respiratory_rate: form.respiratory_rate ? parseInt(form.respiratory_rate) : undefined,
        },
        symptoms: form.symptoms.map((s) => ({ symptom: s })),
      });
      setResult(data);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setForm({ name: "", age: "", gender: "male", contact: "", doctor_id: "", heart_rate: "", bp_systolic: "", bp_diastolic: "", temperature: "", spo2: "", respiratory_rate: "", symptoms: [] });
  }

  const inputCls = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition text-sm";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5";

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">OPD Registration</h1>
            <p className="text-xs text-slate-500">Register patients &amp; compute AI triage score</p>
          </div>
        </div>
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 transition">← Home</Link>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {result ? (
          /* ── Success Card ── */
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-10 text-center max-w-lg mx-auto">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Registration Complete!</h2>
            <p className="text-slate-500 mb-8 text-sm">Patient successfully registered and added to queue.</p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-50 rounded-2xl p-4 text-left">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Patient</p>
                <p className="font-bold text-slate-800">{result.name}</p>
                <p className="text-xs text-slate-500">ID #{result.patient_id}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-left">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Queue Position</p>
                <p className="text-3xl font-black text-indigo-600">#{result.queue_position}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-left">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Triage Score</p>
                <p className="text-3xl font-black text-slate-800">{result.triage_score}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-left flex flex-col gap-2">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Priority</p>
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold inline-block ${PRIORITY_COLORS[result.priority_level]}`}>
                  {result.priority_level}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-semibold text-sm transition">
                Register Another
              </button>
              <Link href="/doctor/queue" className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-3 rounded-xl font-semibold text-sm transition text-center">
                View Queue →
              </Link>
            </div>
          </div>
        ) : (
          /* ── Registration Form ── */
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Patient Details */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                <User className="w-5 h-5 text-slate-400" />
                <h2 className="font-bold text-slate-700">Patient Details</h2>
              </div>

              <div>
                <label className={labelCls}>Full Name *</label>
                <input required className={inputCls} placeholder="e.g. Arun Kumar" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Age *</label>
                  <input required type="number" min={0} max={150} className={inputCls} placeholder="e.g. 34" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Gender *</label>
                  <select required className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Contact (optional)</label>
                <input className={inputCls} placeholder="+91 XXXXXXXXXX" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Assign Doctor *</label>
                <select required className={inputCls} value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                  <option value="">Select a doctor...</option>
                  {doctors.filter((d) => d.status === "available").map((d) => (
                    <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>
                  ))}
                </select>
              </div>

              {/* Symptoms */}
              <div>
                <label className={labelCls}>Symptoms *</label>
                <div className="flex flex-wrap gap-2">
                  {SYMPTOMS.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => toggleSymptom(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        form.symptoms.includes(s)
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Vitals */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                <Activity className="w-5 h-5 text-slate-400" />
                <h2 className="font-bold text-slate-700">Vitals</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Heart Rate (bpm) *</label>
                  <input required type="number" className={inputCls} placeholder="72" value={form.heart_rate} onChange={(e) => setForm({ ...form, heart_rate: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>SpO₂ (%) *</label>
                  <input required type="number" min={0} max={100} className={inputCls} placeholder="98" value={form.spo2} onChange={(e) => setForm({ ...form, spo2: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>BP Systolic (mmHg) *</label>
                  <input required type="number" className={inputCls} placeholder="120" value={form.bp_systolic} onChange={(e) => setForm({ ...form, bp_systolic: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>BP Diastolic (mmHg) *</label>
                  <input required type="number" className={inputCls} placeholder="80" value={form.bp_diastolic} onChange={(e) => setForm({ ...form, bp_diastolic: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Temperature (°F) *</label>
                  <input required type="number" step="0.1" className={inputCls} placeholder="98.6" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Respiratory Rate</label>
                  <input type="number" className={inputCls} placeholder="16 (optional)" value={form.respiratory_rate} onChange={(e) => setForm({ ...form, respiratory_rate: e.target.value })} />
                </div>
              </div>

              {/* Quick reference */}
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Normal Ranges</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-slate-500">
                  <span>❤️ HR: 60–100 bpm</span>
                  <span>🫁 SpO₂: ≥ 95%</span>
                  <span>💉 BP: 90/60–120/80</span>
                  <span>🌡️ Temp: 97–99°F</span>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || form.symptoms.length === 0}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-base transition shadow-lg shadow-teal-500/20"
              >
                {loading ? "Processing Triage..." : "Register & Compute Triage Score"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
