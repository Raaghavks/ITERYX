"use client";

import { useEffect, useState, useCallback } from "react";
import { getQueue, updateQueueStatus } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { QueueEntry, Priority } from "@/types";
import { Users, RefreshCw, Clock, CheckCircle2, Stethoscope } from "lucide-react";
import Link from "next/link";

const PRIORITY_STYLES: Record<Priority, { badge: string; row: string }> = {
  CRITICAL: { badge: "bg-red-600 text-white", row: "border-l-4 border-red-500 bg-red-50/30" },
  HIGH:     { badge: "bg-orange-500 text-white", row: "border-l-4 border-orange-400 bg-orange-50/30" },
  MEDIUM:   { badge: "bg-yellow-400 text-slate-900", row: "border-l-4 border-yellow-400 bg-yellow-50/20" },
  LOW:      { badge: "bg-emerald-500 text-white", row: "border-l-4 border-emerald-400" },
};

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting",
  in_consultation: "In Consultation",
  completed: "Completed",
};

export default function DoctorQueuePage() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [filter, setFilter] = useState<"waiting" | "in_consultation" | "completed" | "all">("waiting");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getQueue(filter === "all" ? undefined : filter);
      // Sort: CRITICAL first, then HIGH, MEDIUM, LOW, then by queue position
      const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      data.sort((a, b) => {
        const pa = priorityOrder[a.triage?.priority_level ?? "LOW"] ?? 4;
        const pb = priorityOrder[b.triage?.priority_level ?? "LOW"] ?? 4;
        if (pa !== pb) return pa - pb;
        return (a.queue_position ?? 999) - (b.queue_position ?? 999);
      });
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time socket
  useEffect(() => {
    const socket = getSocket();
    const handler = () => load();
    socket.on("queue_update", handler);
    return () => { socket.off("queue_update", handler); };
  }, [load]);

  async function changeStatus(id: number, newStatus: string) {
    setUpdating(id);
    try {
      await updateQueueStatus(id, newStatus);
      await load();
    } finally {
      setUpdating(null);
    }
  }

  const filterBtns = ["waiting", "in_consultation", "completed", "all"] as const;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Doctor Queue</h1>
            <p className="text-xs text-slate-500">Real-time prioritized patient queue</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-400 hover:text-slate-600">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 transition">← Home</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 bg-white rounded-2xl border border-slate-100 p-1.5 shadow-sm w-fit">
          {filterBtns.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                filter === f
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {f === "all" ? "All" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Queue List */}
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
                  {/* Position */}
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-sm font-black text-slate-600 flex-shrink-0">
                    {entry.triage?.queue_position ?? idx + 1}
                  </div>

                  {/* Patient Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-slate-800 truncate">{entry.patient?.name ?? "Unknown"}</h3>
                      {entry.triage && (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${style.badge}`}>
                          {priority}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>{entry.patient?.age}y • {entry.patient?.gender}</span>
                      {entry.triage && (
                        <span className="font-semibold text-slate-600">
                          Score: {entry.triage.score}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Stethoscope className="w-3 h-3" />
                        {entry.doctor?.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  {/* Status Controls */}
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
                      <button
                        onClick={() => changeStatus(entry.id, "completed")}
                        disabled={updating === entry.id}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                      >
                        {updating === entry.id ? "..." : "Complete"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
