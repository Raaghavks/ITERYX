"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  createAdmission,
  getAllWards,
  getQueue,
  preallocateBed,
  updateQueueStatus,
} from "@/lib/api";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { getSocket } from "@/lib/socket";
import { PILOT_OPERATIONAL_RULES } from "@/lib/pilot-rules";
import type { PreallocateResult, Priority, QueueEntry, Ward } from "@/types";
import {
  BedDouble,
  CheckCircle2,
  RefreshCw,
  Stethoscope,
  X,
} from "lucide-react";

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
      queueData.sort((left, right) => {
        const leftPriority = priorityOrder[left.triage?.priority_level ?? "LOW"] ?? 4;
        const rightPriority = priorityOrder[right.triage?.priority_level ?? "LOW"] ?? 4;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return (left.queue_position ?? 999) - (right.queue_position ?? 999);
      });

      setEntries(queueData);
      setWards(wardData);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const { connectionState, isFallbackPolling, lastSyncAt, refreshNow } =
    useRealtimeSync({
      load,
      pollIntervalMs: 25000,
      staleAfterMs: 45000,
    });

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
      await createAdmission(activeEntry.patient_id, allocation.bed_id, activeEntry.doctor?.id ?? 1);
      setNotice(`${activeEntry.patient?.name ?? activeEntry.name} admitted to ${allocation.ward_name}.`);
      closeAdmission();
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not admit patient.");
    } finally {
      setAdmitting(false);
    }
  }

  const filterButtons: QueueFilter[] = ["waiting", "in_consultation", "completed", "all"];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.24em] ${
            connectionState === "live"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              connectionState === "live" ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          {connectionState === "live" ? "Realtime connected" : "Polling fallback active"}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            Last sync{" "}
            {lastSyncAt
              ? lastSyncAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "pending"}
          </span>
          <button
            onClick={() => refreshNow()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Queue
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[28px] border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-bold">Pilot operations note</p>
          <p className="mt-1 text-amber-800">
            {PILOT_OPERATIONAL_RULES[0]} {PILOT_OPERATIONAL_RULES[2]}
          </p>
        </div>
        <Link
          href="/admin/pilot"
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 font-semibold text-amber-900 transition hover:bg-amber-100"
        >
          View full pilot rules
        </Link>
      </div>

      {notice && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {notice}
        </div>
      )}

      {isFallbackPolling && (
        <div className="rounded-3xl border border-sky-100 bg-sky-50 px-5 py-3 text-sm text-sky-700 shadow-sm">
          Queue events are temporarily unavailable. This view is automatically refreshing in fallback mode.
        </div>
      )}

      <div className="flex w-fit gap-2 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm">
        {filterButtons.map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all ${
              filter === item
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            {item === "all" ? "All" : STATUS_LABEL[item]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-[32px] border border-white/80 bg-white/95 py-24 text-slate-400 shadow-[0_30px_70px_-50px_rgba(15,23,42,0.45)]">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          Loading queue...
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-[32px] border border-white/80 bg-white/95 py-24 text-center text-slate-400 shadow-[0_30px_70px_-50px_rgba(15,23,42,0.45)]">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          <p className="font-medium">No patients in this queue</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => {
            const priority = entry.triage?.priority_level ?? "LOW";
            const style = PRIORITY_STYLES[priority];

            return (
              <div
                key={entry.id}
                className={`flex items-center gap-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all ${style.row}`}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-600">
                  {entry.triage?.queue_position ?? index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-3">
                    <h3 className="truncate font-bold text-slate-800">
                      {entry.patient?.name ?? entry.name}
                    </h3>
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>
                      {priority}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span>{entry.patient?.age ?? entry.age}y · {entry.patient?.gender ?? entry.gender}</span>
                    <span className="font-semibold text-slate-600">
                      Score: {entry.triage?.score ?? entry.score}
                    </span>
                    <span className="flex items-center gap-1">
                      <Stethoscope className="h-3 w-3" />
                      {entry.doctor?.name ?? "Doctor Pending"}
                    </span>
                    <span>{entry.chief_complaint}</span>
                    <span>{entry.wait_time_mins} min wait</span>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <span
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      entry.status === "waiting"
                        ? "bg-blue-50 text-blue-700"
                        : entry.status === "in_consultation"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {STATUS_LABEL[entry.status]}
                  </span>

                  {entry.status === "waiting" && (
                    <button
                      onClick={() => changeStatus(entry.id, "in_consultation")}
                      disabled={updating === entry.id}
                      className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {updating === entry.id ? "..." : "Call In"}
                    </button>
                  )}

                  {entry.status === "in_consultation" && (
                    <>
                      <button
                        onClick={() => openAdmission(entry)}
                        className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
                      >
                        Reserve Bed
                      </button>
                      <button
                        onClick={() => changeStatus(entry.id, "completed")}
                        disabled={updating === entry.id}
                        className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
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

      {activeEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 p-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800">Admit Patient</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {activeEntry.patient?.name ?? activeEntry.name} · {activeEntry.chief_complaint}
                </p>
              </div>
              <button
                onClick={closeAdmission}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                    Priority
                  </p>
                  <p className="text-lg font-bold text-slate-800">{activeEntry.priority_level}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                    Assigned Doctor
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {activeEntry.doctor?.name ?? "Doctor Pending"}
                  </p>
                </div>
              </div>

              {!allocation ? (
                <>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">
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
                          {ward.name} · {ward.available_count ?? 0} available
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleReserveBed}
                    disabled={allocating}
                    className="w-full rounded-2xl bg-amber-500 py-3.5 font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
                  >
                    {allocating ? "Reserving Bed..." : "Reserve Bed"}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                    <div className="mb-3 flex items-center gap-3">
                      <BedDouble className="h-5 w-5 text-emerald-600" />
                      <p className="font-bold text-emerald-800">Bed reserved successfully</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700/70">Ward</p>
                        <p className="font-semibold text-slate-800">{allocation.ward_name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700/70">Bed</p>
                        <p className="font-semibold text-slate-800">{allocation.bed_number}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleAdmission}
                    disabled={admitting}
                    className="w-full rounded-2xl bg-emerald-600 py-3.5 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
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
    </section>
  );
}
