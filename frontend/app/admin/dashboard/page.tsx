"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  Package2,
  ShieldAlert,
  Users,
  Waves,
} from "lucide-react";

import {
  confirmDischargeOrder,
  getAllBeds,
  getAllWards,
  getDashboardKPIs,
  getPendingDischarges,
} from "@/lib/api";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { getSocket } from "@/lib/socket";
import type {
  Bed,
  DashboardKPIs,
  DischargeOrder,
  EmergencyAlert,
  EmergencyAlertPayload,
  QueueUpdatePayload,
  Ward,
  WardOccupancyChartDatum,
} from "@/types";

const DONUT_COLORS = ["#22c55e", "#ef4444", "#eab308", "#94a3b8"];

type DashboardSnapshot = {
  kpis: DashboardKPIs | null;
  wards: Ward[];
  beds: Bed[];
  discharges: DischargeOrder[];
};

export default function AdminDashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({
    kpis: null,
    wards: [],
    beds: [],
    discharges: [],
  });
  const [chartData, setChartData] = useState<WardOccupancyChartDatum[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [processingDischargeId, setProcessingDischargeId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      setLoadError(null);
      const [kpiData, wards, beds, discharges] = await Promise.all([
        getDashboardKPIs(),
        getAllWards(),
        getAllBeds(),
        getPendingDischarges(),
      ]);

      setSnapshot({ kpis: kpiData, wards, beds, discharges });
      setChartData(
        wards.map((ward: Ward) => {
          const wardBeds = beds.filter((bed: Bed) => bed.ward_id === ward.id);
          return {
            name: ward.name.replace(" Ward", ""),
            Available: wardBeds.filter((bed: Bed) => bed.status === "available").length,
            Occupied: wardBeds.filter((bed: Bed) => bed.status === "occupied").length,
            Reserved: wardBeds.filter((bed: Bed) => bed.status === "reserved").length,
          };
        })
      );
    } catch (error) {
      console.error("Dashboard load error:", error);
      setLoadError(
        error instanceof Error ? error.message : "Unable to load dashboard data."
      );
    }
  }, []);

  const { connectionState, isFallbackPolling, lastSyncAt, refreshNow } =
    useRealtimeSync({
      load: loadAll,
      pollIntervalMs: 25000,
      staleAfterMs: 45000,
    });

  useEffect(() => {
    const socket = getSocket();
    const handleQueueUpdate = (data: QueueUpdatePayload) => {
      if (
        data.totalPatientsToday !== undefined ||
        data.currentQueueLength !== undefined ||
        data.criticalPatients !== undefined
      ) {
        setSnapshot((prev) => ({
          ...prev,
          kpis: prev.kpis
            ? {
                ...prev.kpis,
                totalPatientsToday:
                  data.totalPatientsToday ?? prev.kpis.totalPatientsToday,
                currentQueueLength:
                  data.currentQueueLength ?? prev.kpis.currentQueueLength,
                criticalPatients:
                  data.criticalPatients ?? prev.kpis.criticalPatients,
              }
            : prev.kpis,
        }));
      } else {
        loadAll().catch(() => {});
      }
    };

    const handleBedStatusUpdate = () => {
      loadAll().catch(() => {});
    };

    const handleDischargeOrderUpdate = () => {
      loadAll().catch(() => {});
    };

    const handleEmergencyAlert = (payload: EmergencyAlertPayload) => {
      setAlerts((prev) => [
        { ...payload, id: crypto.randomUUID() },
        ...prev,
      ].slice(0, 8));
    };

    socket.on("queue_update", handleQueueUpdate);
    socket.on("bed_status_update", handleBedStatusUpdate);
    socket.on("discharge_order_update", handleDischargeOrderUpdate);
    socket.on("emergency_alert", handleEmergencyAlert);

    return () => {
      socket.off("queue_update", handleQueueUpdate);
      socket.off("bed_status_update", handleBedStatusUpdate);
      socket.off("discharge_order_update", handleDischargeOrderUpdate);
      socket.off("emergency_alert", handleEmergencyAlert);
    };
  }, [loadAll]);

  const totalBeds = snapshot.beds.length;
  const availableBeds = snapshot.beds.filter((bed) => bed.status === "available").length;
  const occupiedBeds = snapshot.beds.filter((bed) => bed.status === "occupied").length;
  const reservedBeds = snapshot.beds.filter((bed) => bed.status === "reserved").length;
  const maintenanceBeds = snapshot.beds.filter((bed) => bed.status === "maintenance").length;
  const occupancyRate = totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const pendingDischarges = snapshot.discharges.length;
  const operationsAlerts = reservedBeds + maintenanceBeds;
  const emergencyCount = snapshot.kpis?.criticalPatients ?? 0;
  const appointmentsCount = 0;

  const recentAdmissions = [...snapshot.beds]
    .filter((bed) => bed.status === "occupied" && bed.patient_name)
    .sort((left, right) => {
      const leftTime = left.admitted_since ? new Date(left.admitted_since).getTime() : 0;
      const rightTime = right.admitted_since ? new Date(right.admitted_since).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 5);

  const kpiCards = [
    {
      title: "Total Patients",
      value: snapshot.kpis?.totalPatientsToday ?? 0,
      icon: Users,
      tone: "from-blue-600 to-blue-500",
      iconShell: "bg-blue-100 text-blue-700",
      helper: "Across current operating shift",
    },
    {
      title: "Active Admissions",
      value: occupiedBeds,
      icon: HeartPulse,
      tone: "from-emerald-600 to-emerald-500",
      iconShell: "bg-emerald-100 text-emerald-700",
      helper: "Patients currently occupying a bed",
    },
    {
      title: "Available Beds",
      value: availableBeds,
      icon: BedDouble,
      tone: "from-cyan-600 to-sky-500",
      iconShell: "bg-cyan-100 text-cyan-700",
      helper: "Ready for new admissions",
    },
    {
      title: "Today's Appointments",
      value: appointmentsCount,
      icon: CalendarDays,
      tone: "from-violet-600 to-fuchsia-500",
      iconShell: "bg-violet-100 text-violet-700",
      helper: "Scheduled visits in this portal",
    },
    {
      title: "Occupied Beds",
      value: occupiedBeds,
      icon: BedDouble,
      tone: "from-rose-600 to-red-500",
      iconShell: "bg-rose-100 text-rose-700",
      helper: "Beds currently assigned",
    },
    {
      title: "Emergency Cases",
      value: emergencyCount,
      icon: ShieldAlert,
      tone: "from-amber-500 to-orange-500",
      iconShell: "bg-amber-100 text-amber-700",
      helper: "Critical patients needing attention",
    },
    {
      title: "Pending Discharges",
      value: pendingDischarges,
      icon: ClipboardList,
      tone: "from-orange-500 to-yellow-500",
      iconShell: "bg-orange-100 text-orange-700",
      helper: "Awaiting bed release confirmation",
    },
    {
      title: "Bed Occupancy",
      value: `${occupancyRate}%`,
      icon: Waves,
      tone: "from-indigo-600 to-blue-500",
      iconShell: "bg-indigo-100 text-indigo-700",
      helper: `${occupiedBeds} of ${totalBeds} beds in use`,
    },
  ];

  const bedDistribution = [
    { name: "Available", value: availableBeds },
    { name: "Occupied", value: occupiedBeds },
    { name: "Reserved", value: reservedBeds },
    { name: "Maintenance", value: maintenanceBeds },
  ].filter((item) => item.value > 0);

  async function handleConfirmDischarge(order: DischargeOrder) {
    setActionError(null);
    setProcessingDischargeId(order.id);
    try {
      await confirmDischargeOrder(order.id, order.doctor_id);
      setNotice(`${order.patient_name} discharged and ${order.bed_number} is available again.`);
      await loadAll();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not confirm discharge."
      );
    } finally {
      setProcessingDischargeId(null);
    }
  }

  return (
    <section className="space-y-5">
      {notice && (
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
          {notice}
        </div>
      )}

      {actionError && (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm">
          {actionError}
        </div>
      )}

      {loadError && (
        <div className="rounded-3xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 shadow-sm">
          {loadError}
        </div>
      )}

      <div className="space-y-3">
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
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Refresh now
            </button>
          </div>
        </div>

        {emergencyCount > 0 && (
          <div className="flex items-center gap-3 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-rose-700 shadow-sm">
            <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0" />
            <p className="text-sm font-semibold">
              {emergencyCount} Emergency Patient{emergencyCount > 1 ? "s" : ""} requiring immediate attention
            </p>
          </div>
        )}

        {operationsAlerts > 0 && (
          <div className="flex items-center gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-amber-800 shadow-sm">
            <Package2 className="h-4.5 w-4.5 flex-shrink-0" />
            <p className="text-sm font-semibold">
              {operationsAlerts} bed flow alert{operationsAlerts > 1 ? "s" : ""} driven by reserved or maintenance beds
            </p>
          </div>
        )}

        {isFallbackPolling && (
          <div className="rounded-3xl border border-sky-100 bg-sky-50 px-5 py-3 text-sm text-sky-700 shadow-sm">
            Live socket updates are temporarily unavailable. The dashboard is auto-refreshing in fallback mode.
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-[26px] border border-white/80 bg-white/95 p-5 shadow-[0_26px_60px_-50px_rgba(15,23,42,0.45)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                    {card.title}
                  </p>
                  <p className="mt-3 text-4xl font-black tracking-tight text-slate-900">
                    {card.value}
                  </p>
                </div>
                <div className={`rounded-2xl ${card.iconShell} p-3.5`}>
                  <Icon className="h-5.5 w-5.5" />
                </div>
              </div>
              <div className={`mt-5 h-1.5 rounded-full bg-gradient-to-r ${card.tone}`} />
              <p className="mt-4 text-sm leading-6 text-slate-500">{card.helper}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <article className="rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_26px_60px_-50px_rgba(15,23,42,0.45)]">
          <h2 className="text-xl font-bold text-slate-900">Bed Status by Ward</h2>
          <p className="mt-1 text-sm text-slate-500">
            Live availability, occupancy, and reserved beds by ward.
          </p>

          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(148,163,184,0.08)" }}
                  contentStyle={{
                    borderRadius: 20,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 24px 48px -32px rgba(15, 23, 42, 0.35)",
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 24 }} />
                <Bar dataKey="Available" fill="#22c55e" radius={[10, 10, 0, 0]} />
                <Bar dataKey="Occupied" fill="#ef4444" radius={[10, 10, 0, 0]} />
                <Bar dataKey="Reserved" fill="#eab308" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_26px_60px_-50px_rgba(15,23,42,0.45)]">
            <h2 className="text-xl font-bold text-slate-900">Bed Distribution</h2>
            <p className="mt-1 text-sm text-slate-500">Current mix of available and assigned beds.</p>

            <div className="mt-4 flex h-[220px] items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bedDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={4}
                  >
                    {bedDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {bedDistribution.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                    />
                    <span className="text-slate-600">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_26px_60px_-50px_rgba(15,23,42,0.45)]">
            <h2 className="text-xl font-bold text-slate-900">Today&apos;s Summary</h2>
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Appointments</span>
                <span className="font-bold text-blue-600">{appointmentsCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Active Admissions</span>
                <span className="font-bold text-emerald-600">{occupiedBeds}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Emergency</span>
                <span className="font-bold text-rose-600">{emergencyCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Beds Free</span>
                <span className="font-bold text-cyan-600">{availableBeds}</span>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <article className="rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_26px_60px_-50px_rgba(15,23,42,0.45)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Recent Admissions</h2>
              <p className="mt-1 text-sm text-slate-500">A compact view of newly occupied beds.</p>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {recentAdmissions.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
                No active admissions to display yet.
              </div>
            ) : (
              recentAdmissions.map((bed) => (
                <div
                  key={bed.id}
                  className="flex items-center justify-between gap-4 rounded-[22px] border border-slate-100 bg-slate-50/80 px-4 py-3.5"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-sm font-black text-blue-700">
                      {bed.patient_initials || "PT"}
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-900">{bed.patient_name}</p>
                      <p className="text-sm text-slate-500">
                        Bed: {bed.bed_number} · {bed.ward_name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      Active
                    </span>
                    <p className="mt-2 text-sm text-slate-500">
                      {bed.admitted_since
                        ? new Date(bed.admitted_since).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Recently admitted"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_26px_60px_-50px_rgba(15,23,42,0.45)]">
            <h2 className="text-xl font-bold text-slate-900">Pending Discharges</h2>
            <div className="mt-6 space-y-3">
              {snapshot.discharges.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  No pending discharge orders.
                </div>
              ) : (
                snapshot.discharges.map((discharge) => (
                  <div
                    key={discharge.id}
                    className="rounded-[22px] border border-slate-100 bg-slate-50/90 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{discharge.patient_name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {discharge.bed_number} · {discharge.ward_name}
                        </p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                          Expected {new Date(discharge.expected_discharge_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleConfirmDischarge(discharge)}
                        disabled={processingDischargeId === discharge.id}
                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {processingDischargeId === discharge.id ? "Updating..." : "Confirm"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="overflow-hidden rounded-[28px] border border-white/40 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 p-5 text-white shadow-[0_30px_70px_-50px_rgba(14,165,233,0.8)]">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/80">
              Bed Occupancy Rate
            </p>
            <p className="mt-3 text-5xl font-black tracking-tight">{occupancyRate}%</p>
            <p className="mt-3 text-sm text-white/80">
              {occupiedBeds} of {totalBeds} beds are currently occupied.
            </p>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${Math.max(occupancyRate, 8)}%` }}
              />
            </div>

            <div className="mt-5 h-[82px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData.map((item) => ({
                    name: item.name,
                    usage: item.Occupied + item.Reserved,
                  }))}
                  margin={{ top: 6, left: 0, right: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="occupancyWave" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: "none",
                      boxShadow: "0 18px 48px -32px rgba(15, 23, 42, 0.55)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="usage"
                    stroke="#ffffff"
                    strokeWidth={2.4}
                    fill="url(#occupancyWave)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>
        </div>
      </div>

      {alerts.length > 0 && (
        <article className="rounded-[28px] border border-rose-100 bg-white/95 p-5 shadow-[0_26px_60px_-50px_rgba(15,23,42,0.45)]">
          <h2 className="text-xl font-bold text-slate-900">Live Emergency Feed</h2>
          <div className="mt-6 space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between gap-4 rounded-[22px] border border-rose-100 bg-rose-50 px-4 py-3.5"
              >
                <div>
                  <p className="font-bold text-slate-900">{alert.patient_name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {new Date(alert.timestamp).toLocaleTimeString()} · Score {alert.score}
                  </p>
                </div>
                <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white">
                  {alert.priority}
                </span>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}
