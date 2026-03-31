"use client";

import { useCallback, useEffect, useState } from "react";
import { getQueue } from "@/lib/api";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import type { Priority, QueueEntry } from "@/types";
import { CheckCircle2, RefreshCw } from "lucide-react";

const PRIORITY_STYLES: Record<Priority, string> = {
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-500 text-white",
  MEDIUM: "bg-yellow-400 text-slate-900",
  LOW: "bg-emerald-500 text-white",
};

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting",
  in_consultation: "In Consultation",
  completed: "Completed",
};

type QueueFilter = "waiting" | "in_consultation" | "completed" | "all";

export default function AppointmentsPage() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const queueData = await getQueue(filter === "all" ? undefined : filter);
      const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      queueData.sort((left, right) => {
        const leftPriority = priorityOrder[left.triage?.priority_level ?? left.priority_level ?? "LOW"] ?? 4;
        const rightPriority = priorityOrder[right.triage?.priority_level ?? right.priority_level ?? "LOW"] ?? 4;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return (left.queue_position ?? 999) - (right.queue_position ?? 999);
      });
      setEntries(queueData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load appointments.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const { connectionState, lastSyncAt, refreshNow } = useRealtimeSync({
    load,
    pollIntervalMs: 25000,
    staleAfterMs: 45000,
  });

  useEffect(() => {
    void load();
  }, [filter, load]);

  const filterButtons: QueueFilter[] = ["waiting", "in_consultation", "completed", "all"];
  const visibleEntries =
    filter === "all" ? entries : entries.filter((entry) => entry.status === filter);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.24em] ${
            connectionState === "live" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
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
            Last sync {lastSyncAt ? lastSyncAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "pending"}
          </span>
          <button
            onClick={() => void refreshNow()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Appointments
          </button>
        </div>
      </div>

      <div className="flex w-fit gap-2 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm">
        {filterButtons.map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all ${
              filter === item ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            {item === "all" ? "All" : STATUS_LABEL[item]}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-[32px] border border-white/80 bg-white/95 py-24 text-slate-400 shadow-[0_30px_70px_-50px_rgba(15,23,42,0.45)]">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          Loading appointments...
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="rounded-[32px] border border-white/80 bg-white/95 py-24 text-center text-slate-400 shadow-[0_30px_70px_-50px_rgba(15,23,42,0.45)]">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          <p className="font-medium">No appointments in this view</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleEntries.map((entry, index) => {
            const priority = entry.triage?.priority_level ?? entry.priority_level ?? "LOW";
            return (
              <div
                key={entry.id}
                className="flex items-center gap-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-600">
                  {entry.triage?.queue_position ?? index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-3">
                    <h3 className="truncate font-bold text-slate-800">{entry.patient?.name ?? entry.name}</h3>
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${PRIORITY_STYLES[priority]}`}>
                      {priority}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span>{entry.patient?.age ?? entry.age}y · {entry.patient?.gender ?? entry.gender}</span>
                    <span className="font-semibold text-slate-600">Score: {entry.triage?.score ?? entry.score}</span>
                    <span>{entry.chief_complaint}</span>
                    <span>{entry.wait_time_mins} min wait</span>
                  </div>
                </div>

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
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
