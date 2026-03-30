"use client";

import { useEffect, useState } from "react";
import { getAllWards, getAllBeds, updateBedStatus } from "@/lib/api";
import { getSocket, joinWard } from "@/lib/socket";
import type { Ward, Bed, BedStatus } from "@/types";
import { X, User, Clock, Stethoscope, BedDouble, Activity } from "lucide-react";
import Link from "next/link";

const STATUS_COLORS: Record<BedStatus, { card: string; label: string }> = {
  available:   { card: "bg-[#22c55e] border-[#16a34a]", label: "bg-emerald-100 text-emerald-800" },
  occupied:    { card: "bg-[#ef4444] border-[#dc2626]", label: "bg-red-100 text-red-800" },
  reserved:    { card: "bg-[#eab308] border-[#ca8a04]", label: "bg-yellow-100 text-yellow-800" },
  maintenance: { card: "bg-[#6b7280] border-[#4b5563]", label: "bg-slate-100 text-slate-800" },
};

export default function BedsPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Bed | null>(null);
  const [newStatus, setNewStatus] = useState<BedStatus>("available");
  const [reserveId, setReserveId] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function load() {
      const [w, b] = await Promise.all([getAllWards(), getAllBeds()]);
      setWards(w);
      setBeds(b);
      setLoading(false);
      // Join all ward rooms for real-time updates
      w.forEach((ward) => joinWard(ward.id));
    }
    load();
  }, []);

  // Socket real-time: surgical update without re-fetch
  useEffect(() => {
    const socket = getSocket();
    const handler = ({ bed_id, new_status }: { bed_id: number; new_status: BedStatus; ward_id: number }) => {
      setBeds((prev) => prev.map((b) => b.id === bed_id ? { ...b, status: new_status } : b));
      setSelected((prev) => prev && prev.id === bed_id ? { ...prev, status: new_status } : prev);
    };
    socket.on("bed_status_update", handler);
    return () => { socket.off("bed_status_update", handler); };
  }, []);

  // Recompute ward occupancy from local bed state
  const wardOccupancy = (wardId: number) => {
    const wb = beds.filter((b) => b.ward_id === wardId);
    return { total: wb.length, occupied: wb.filter((b) => b.status === "occupied").length };
  };

  async function handleUpdateStatus() {
    if (!selected) return;
    setUpdating(true);
    try {
      await updateBedStatus(
        selected.id,
        newStatus,
        newStatus === "reserved" && reserveId ? parseInt(reserveId) : undefined
      );
      // Optimistic update; socket will confirm
      setBeds((prev) => prev.map((b) => b.id === selected.id ? { ...b, status: newStatus } : b));
      setSelected(null);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Activity className="animate-spin w-8 h-8 text-violet-500 mr-3" />
        <span className="text-slate-500 font-medium">Loading bed map...</span>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
            <BedDouble className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Bed Map</h1>
            <p className="text-xs text-slate-500">Live hospital bed availability</p>
          </div>
        </div>
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 transition">← Home</Link>
      </header>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Left — Bed Grid (70%) */}
        <div className="w-[70%] overflow-y-auto p-6 flex flex-col gap-6">
          {/* Legend */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-5 items-center justify-between">
            <span className="text-sm font-bold text-slate-600 uppercase tracking-widest">Color Legend</span>
            <div className="flex items-center gap-5 text-sm font-medium">
              {(["available", "occupied", "reserved", "maintenance"] as BedStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${STATUS_COLORS[s].card.split(" ")[0]}`} />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
              ))}
            </div>
          </div>

          {/* Ward sections */}
          {wards.map((ward) => {
            const { total, occupied } = wardOccupancy(ward.id);
            const wardBeds = beds.filter((b) => b.ward_id === ward.id);
            return (
              <div key={ward.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-50">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{ward.name}</h3>
                    <p className="text-xs text-slate-400">{ward.location}</p>
                  </div>
                  <span className="px-4 py-1.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-full text-sm font-semibold">
                    {occupied} / {total} occupied
                  </span>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {wardBeds.map((bed) => (
                    <button
                      key={bed.id}
                      onClick={() => { setSelected(bed); setNewStatus(bed.status); setReserveId(""); }}
                      title={`${bed.number} — ${bed.status}`}
                      className={`
                        aspect-square rounded-xl border-b-4 flex flex-col items-center justify-center p-1.5
                        text-white transition-all duration-500 hover:-translate-y-1 hover:shadow-lg active:scale-95
                        ${STATUS_COLORS[bed.status].card}
                      `}
                    >
                      <span className="text-[10px] font-black leading-none">{bed.number}</span>
                      {bed.status === "occupied" && bed.patient_initials && (
                        <span className="text-[9px] font-bold bg-white/20 rounded px-0.5 mt-0.5 leading-tight">
                          {bed.patient_initials}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right — Prediction Sidebar (30%) */}
        <div className="w-[30%] border-l border-slate-100 bg-white p-6 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🔮</span>
            <h2 className="text-lg font-bold text-slate-800">Predicted Vacancy</h2>
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-6">Next 2 Hours Forecast</p>

          <div className="space-y-6">
            {wards.map((ward) => {
              const { total, occupied } = wardOccupancy(ward.id);
              const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
              const available = beds.filter((b) => b.ward_id === ward.id && b.status === "available").length;
              const reserved = beds.filter((b) => b.ward_id === ward.id && b.status === "reserved").length;
              // Rough prediction: available + ~half of reserved could free up
              const expectedFree = Math.max(available + Math.floor(reserved * 0.5), 0);

              return (
                <div key={ward.id}>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="font-semibold text-slate-700 text-sm">{ward.name}</span>
                    <span className="text-xs text-slate-400 font-medium">{pct}% full</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        pct > 80 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg inline-block">
                    ~{expectedFree} beds expected free in 2 hrs
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bed Detail Popover */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-2xl font-black text-slate-800">{selected.number}</h3>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mt-0.5">{selected.ward_name}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Status badge */}
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current Status</span>
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase ${STATUS_COLORS[selected.status].label}`}>
                  {selected.status}
                </span>
              </div>

              {/* Occupied patient details */}
              {selected.status === "occupied" && (
                <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Patient</p>
                      <p className="text-sm font-bold text-slate-800">{selected.patient_name ?? "Unknown"}</p>
                    </div>
                  </div>
                  {selected.admitted_since && (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                        <Clock className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Admitted Since</p>
                        <p className="text-sm font-bold text-slate-800">{new Date(selected.admitted_since).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                  {selected.assigned_doctor && (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
                        <Stethoscope className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Assigned Doctor</p>
                        <p className="text-sm font-bold text-slate-800">{selected.assigned_doctor}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reserve input if available */}
              {selected.status === "available" && (
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                  <label className="block text-xs font-bold text-emerald-800 mb-2 uppercase tracking-wider">Reserve for Patient</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Patient ID..."
                      value={reserveId}
                      onChange={(e) => setReserveId(e.target.value)}
                      className="flex-1 bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800"
                    />
                    <button
                      onClick={() => { setNewStatus("reserved"); handleUpdateStatus(); }}
                      disabled={!reserveId || updating}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50"
                    >
                      Reserve
                    </button>
                  </div>
                </div>
              )}

              {/* Status override */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Override Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as BedStatus)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                  <option value="maintenance">Maintenance</option>
                </select>
                <button
                  onClick={handleUpdateStatus}
                  disabled={updating || newStatus === selected.status}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-2xl text-sm transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                >
                  {updating ? "Updating..." : "Update Bed Status"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
