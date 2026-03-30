"use client";

import { useEffect, useState, useCallback } from "react";
import {
  createAdmission,
  getAllWards,
  getQueue,
  preallocateBed,
  updateQueueStatus,
} from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { PreallocateResult, Priority, QueueEntry, Ward } from "@/types";
import {
  BedDouble,
  CheckCircle2,
  RefreshCw,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";

const PRIORITY_STYLES: Record<Priority, { badge: string; row: string }> = {
  CRITICAL: { badge: "bg-red-600 text-white", row: "border-l-4 border-red-500 bg-red-50/30" },
  HIGH: { badge: "bg-orange-500 text-white", row: "border-l-4 border-orange-400 bg-orange-50/30" },
  MEDIUM: { badge: "bg-yellow-400 text-slate-900", row: "border-l-4 border-yellow-400 bg-yellow-50/20" },
  LOW: { badge: "bg-emerald-500 text-white", row: "border-l-4 border-emerald-400" },
};

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting",
  in_consultation: "In Consultation",
  completed: "Completed",
};

type QueueFilter = "waiting" | "in_consultation" | "completed" | "all";

export default function DoctorQueuePage() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [filter, setFilter] = useState<QueueFilter>("waiting");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [activeEntry, setActiveEntry] = useState<QueueEntry | null>(null);
  const [selectedWardId, setSelectedWardId] = useState<string>("");
  const [allocation, setAllocation] = useState<PreallocateResult | null>(null);
  const [allocating, setAllocating] = useState(false);
  const [admitting, setAdmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queueData, wardData] = await Promise.all([
        getQueue(filter === "all" ? undefined : filter),
        getAllWards(),
      ]);

      const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      queueData.sort((a, b) => {
        const pa = priorityOrder[a.triage?.priority_level ?? "LOW"] ?? 4;
        const pb = priorityOrder[b.triage?.priority_level ?? "LOW"] ?? 4;
        if (pa !== pb) return pa - pb;
        return (a.queue_position ?? 999) - (b.queue_position ?? 999);
      });

      setEntries(queueData);
      setWards(wardData);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = getSocket();
    const handler = () => load();
    socket.on("queue_update", handler);
    socket.on("bed_status_update", handler);
    return () => {
      socket.off("queue_update", handler);
      socket.off("bed_status_update", handler);
    };
  }, [load]);

  async function changeStatus(id: number, newStatus: string) {
    setUpdating(id);
    try {
      await updateQueueStatus(id, newStatus);
      setNotice(`Queue status updated to ${STATUS_LABEL[newStatus]}.`);
      await load();
    } finally {
      setUpdating(null);
    }
  }

  function openAdmission(entry: QueueEntry) {
    setActiveEntry(entry);
    setSelectedWardId("");
    setAllocation(null);
    setActionError(null);
  }

  function closeAdmission() {
    setActiveEntry(null);
    setSelectedWardId("");
    setAllocation(null);
    setActionError(null);
  }

  async function handleReserveBed() {
    if (!activeEntry) return;
    setAllocating(true);
    setActionError(null);
    try {
      const reserved = await preallocateBed(
        activeEntry.patient_id,
        selectedWardId ? Number(selectedWardId) : undefined
      );
      setAllocation(reserved);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not reserve a bed.");
    } finally {
      setAllocating(false);
    }
  }

  async function handleAdmission() {
    if (!activeEntry || !allocation) return;
    setAdmitting(true);
    setActionError(null);
    try {
      await createAdmission(
        activeEntry.patient_id,
        allocation.bed_id,
        activeEntry.doctor?.id ?? 1
      );
      setNotice(`${activeEntry.patient?.name ?? activeEntry.name} admitted to ${allocation.ward_name}.`);
      closeAdmission();
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not admit patient.");
    } finally {
      setAdmitting(false);
    }
  }

  const filterBtns: QueueFilter[] = ["waiting", "in_consultation", "completed", "all"];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Doctor Queue</h1>
            <p className="text-xs text-slate-500">Real-time prioritized patient queue and admission flow</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-400 hover:text-slate-600">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 transition">Home</Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {notice && (
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {notice}
          </div>
        )}

        <div className="flex gap-2 mb-6 bg-white rounded-2xl border border-slate-100 p-1.5 shadow-sm w-fit">
          {filterBtns.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                filter === item
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item === "all" ? "All" : STATUS_LABEL[item]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading queue...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p className="font-medium">No patients in this queue</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, idx) => {
              const priority = entry.triage?.priority_level ?? "LOW";
              const style = PRIORITY_STYLES[priority];

              return (
                <div key={entry.id} className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-5 transition-all ${style.row}`}>
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-sm font-black text-slate-600 flex-shrink-0">
                    {entry.triage?.queue_position ?? idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-slate-800 truncate">{entry.patient?.name ?? entry.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${style.badge}`}>
                        {priority}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span>{entry.patient?.age ?? entry.age}y • {entry.patient?.gender ?? entry.gender}</span>
                      <span className="font-semibold text-slate-600">Score: {entry.triage?.score ?? entry.score}</span>
                      <span className="flex items-center gap-1">
                        <Stethoscope className="w-3 h-3" />
                        {entry.doctor?.name ?? "Doctor Pending"}
                      </span>
                      <span>{entry.chief_complaint}</span>
                      <span>{entry.wait_time_mins} min wait</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      entry.status === "waiting" ? "bg-blue-50 text-blue-700" :
                      entry.status === "in_consultation" ? "bg-purple-50 text-purple-700" :
                      "bg-emerald-50 text-emerald-700"
                    }`}>
                      {STATUS_LABEL[entry.status]}
                    </span>

                    {entry.status === "waiting" && (
                      <button
                        onClick={() => changeStatus(entry.id, "in_consultation")}
                        disabled={updating === entry.id}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                      >
                        {updating === entry.id ? "..." : "Call In"}
                      </button>
                    )}

                    {entry.status === "in_consultation" && (
                      <>
                        <button
                          onClick={() => openAdmission(entry)}
                          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition"
                        >
                          Reserve Bed
                        </button>
                        <button
                          onClick={() => changeStatus(entry.id, "completed")}
                          disabled={updating === entry.id}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                        >
                          {updating === entry.id ? "..." : "Complete"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-start justify-between p-6 border-b border-slate-100 bg-slate-50">
              <div>
                <h2 className="text-2xl font-black text-slate-800">Admit Patient</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {activeEntry.patient?.name ?? activeEntry.name} • {activeEntry.chief_complaint}
                </p>
              </div>
              <button onClick={closeAdmission} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Priority</p>
                  <p className="text-lg font-bold text-slate-800">{activeEntry.priority_level}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Assigned Doctor</p>
                  <p className="text-lg font-bold text-slate-800">{activeEntry.doctor?.name ?? "Doctor Pending"}</p>
                </div>
              </div>

              {!allocation ? (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                      Preferred Ward
                    </label>
                    <select
                      value={selectedWardId}
                      onChange={(event) => setSelectedWardId(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="">Auto-select best available ward</option>
                      {wards.map((ward) => (
                        <option key={ward.id} value={ward.id}>
                          {ward.name} • {ward.available_count ?? 0} available
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleReserveBed}
                    disabled={allocating}
                    className="w-full rounded-2xl bg-amber-500 hover:bg-amber-600 text-white py-3.5 font-bold transition disabled:opacity-50"
                  >
                    {allocating ? "Reserving Bed..." : "Reserve Bed"}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <BedDouble className="w-5 h-5 text-emerald-600" />
                      <p className="font-bold text-emerald-800">Bed reserved successfully</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-emerald-700/70 uppercase text-xs font-bold tracking-widest">Ward</p>
                        <p className="font-semibold text-slate-800">{allocation.ward_name}</p>
                      </div>
                      <div>
                        <p className="text-emerald-700/70 uppercase text-xs font-bold tracking-widest">Bed</p>
                        <p className="font-semibold text-slate-800">{allocation.bed_number}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleAdmission}
                    disabled={admitting}
                    className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 font-bold transition disabled:opacity-50"
                  >
                    {admitting ? "Admitting Patient..." : "Confirm Admission"}
                  </button>
                </div>
              )}

              {actionError && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {actionError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
