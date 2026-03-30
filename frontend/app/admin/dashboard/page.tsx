"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Users, ListOrdered, BedDouble, AlertTriangle, Trash2, Activity, LayoutDashboard } from "lucide-react";
import Link from "next/link";

import { getDashboardKPIs, getAllWards, getAllBeds, getPendingDischarges } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { DashboardKPIs, DischargeOrder, EmergencyAlert, Ward, Bed, BedStatus } from "@/types";

export default function AdminDashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [discharges, setDischarges] = useState<DischargeOrder[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);

  // Load initial data
  const loadAll = useCallback(async () => {
    try {
      const [kpiData, wards, beds, dischargeData] = await Promise.all([
        getDashboardKPIs(),
        getAllWards(),
        getAllBeds(),
        getPendingDischarges(),
      ]);

      setKpis(kpiData);
      setDischarges(dischargeData);

      // Build chart data from real beds
      setChartData(
        wards.map((ward: Ward) => {
          const wb = beds.filter((b: Bed) => b.ward_id === ward.id);
          return {
            name: ward.name.replace(" Ward", "").replace("Orthopedic", "Ortho"),
            Available: wb.filter((b: Bed) => b.status === "available").length,
            Occupied: wb.filter((b: Bed) => b.status === "occupied").length,
            Reserved: wb.filter((b: Bed) => b.status === "reserved").length,
          };
        })
      );
    } catch (e) {
      console.error("Dashboard load error:", e);
    }
  }, []);

  useEffect(() => {
    loadAll();
    // Refresh discharges every 2 minutes
    const interval = setInterval(async () => {
      const d = await getPendingDischarges();
      setDischarges(d);
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadAll]);

  // Real-time sockets
  useEffect(() => {
    const socket = getSocket();

    socket.on("queue_update", (data: Partial<DashboardKPIs>) => {
      setKpis((prev) =>
        prev
          ? {
              ...prev,
              totalPatientsToday: data.totalPatientsToday ?? prev.totalPatientsToday,
              currentQueueLength: data.currentQueueLength ?? prev.currentQueueLength,
              criticalPatients: data.criticalPatients ?? prev.criticalPatients,
            }
          : prev
      );
    });

    socket.on("bed_status_update", ({ new_status }: { bed_id: number; new_status: BedStatus; ward_id: number }) => {
      // Reload KPIs to get fresh occupancy
      getDashboardKPIs().then(setKpis).catch(() => {});
    });

    socket.on("emergency_alert", (data: Omit<EmergencyAlert, "id">) => {
      const alert: EmergencyAlert = { ...data, id: crypto.randomUUID() };
      setAlerts((prev) => [alert, ...prev].slice(0, 10));
    });

    return () => {
      socket.off("queue_update");
      socket.off("bed_status_update");
      socket.off("emergency_alert");
    };
  }, []);

  function getDischargeColor(isoTime: string) {
    const diff = (new Date(isoTime).getTime() - Date.now()) / 60000;
    if (diff <= 30) return "text-red-600 bg-red-50 font-bold";
    if (diff <= 60) return "text-yellow-600 bg-yellow-50 font-bold";
    return "text-emerald-600 bg-emerald-50 font-semibold";
  }

  const kpiCards = [
    { title: "Total Patients Today", value: kpis?.totalPatientsToday ?? "—", icon: Users, bg: "bg-blue-50", color: "text-blue-500" },
    { title: "Current Queue", value: kpis?.currentQueueLength ?? "—", icon: ListOrdered, bg: "bg-indigo-50", color: "text-indigo-500" },
    { title: "Bed Occupancy", value: kpis ? `${kpis.overallBedOccupancy}%` : "—", icon: BedDouble, bg: "bg-violet-50", color: "text-violet-500" },
    { title: "Critical Patients", value: kpis?.criticalPatients ?? "—", icon: AlertTriangle, bg: "bg-rose-50", color: "text-rose-500" },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-600 rounded-xl flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Admin Dashboard</h1>
            <p className="text-xs text-slate-500">KPIs, occupancy, and alerts in real-time</p>
          </div>
        </div>
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 transition">← Home</Link>
      </header>

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* SECTION 1: KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center justify-between group hover:shadow-md transition-shadow">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{card.title}</p>
                  <p className="text-4xl font-black text-slate-800 tracking-tight">{card.value}</p>
                </div>
                <div className={`p-4 rounded-2xl ${card.bg} group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* SECTION 2 + 3: Chart + Discharges */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Occupancy Chart */}
          <div className="lg:w-[60%] bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Current Bed Utilization by Ward</h2>
            {chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-300">
                <Activity className="w-6 h-6 animate-spin mr-2" /> Loading chart...
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)" }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: 16 }} />
                    <Bar dataKey="Available" stackId="a" fill="#22c55e" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="Occupied" stackId="a" fill="#ef4444" />
                    <Bar dataKey="Reserved" stackId="a" fill="#eab308" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Pending Discharges */}
          <div className="lg:w-[40%] bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Pending Discharges</h2>
            <div className="flex-1 overflow-y-auto space-y-3">
              {discharges.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-12 italic">No pending discharges.</p>
              ) : (
                discharges.map((d) => (
                  <div key={d.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-sm transition-all gap-3">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{d.patient_name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded font-semibold uppercase">{d.ward_name}</span>
                        <span className="text-[10px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded font-semibold uppercase">Bed: {d.bed_number}</span>
                      </div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${getDischargeColor(d.expected_discharge_at)}`}>
                      Expected: {new Date(d.expected_discharge_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SECTION 4: Emergency Alerts Feed */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
              Emergency Alerts Feed
            </h2>
            <button
              onClick={() => setAlerts([])}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
            >
              <Trash2 className="w-4 h-4" /> Clear All
            </button>
          </div>

          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                <AlertTriangle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm font-medium">System quiet — no active alerts</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center gap-4 bg-rose-50 border border-rose-100 p-4 rounded-2xl shadow-sm"
                  style={{ animation: "slideInDown 0.3s ease" }}
                >
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{alert.patient_name}</p>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Score</p>
                      <p className="text-xl font-black text-rose-600 font-mono">{alert.score}</p>
                    </div>
                    <span className={`px-3 py-1.5 text-xs font-black rounded-full border ${
                      alert.priority === "CRITICAL" ? "bg-rose-600 text-white border-rose-700" :
                      alert.priority === "HIGH" ? "bg-orange-500 text-white border-orange-600" :
                      "bg-yellow-400 text-slate-900 border-yellow-500"
                    }`}>
                      {alert.priority}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
