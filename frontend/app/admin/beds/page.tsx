"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BedDouble,
  Clock,
  Plus,
  RefreshCw,
  Stethoscope,
  User,
  X,
} from "lucide-react";

import {
  createDischargeOrder,
  getAllBeds,
  getAllWards,
  getWardPredictions,
  updateBedStatus,
} from "@/lib/api";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { getSocket, joinWard } from "@/lib/socket";
import type { Bed, BedStatus, Ward, WardPrediction } from "@/types";

const STATUS_STYLES: Record<
  BedStatus,
  {
    pill: string;
    tile: string;
    dot: string;
  }
> = {
  available: {
    pill: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    tile: "border-emerald-300 bg-emerald-100/80 text-emerald-900",
    dot: "bg-emerald-500",
  },
  occupied: {
    pill: "bg-rose-100 text-rose-800 border border-rose-200",
    tile: "border-rose-300 bg-rose-50 text-rose-800",
    dot: "bg-rose-500",
  },
  reserved: {
    pill: "bg-amber-100 text-amber-800 border border-amber-200",
    tile: "border-amber-300 bg-amber-50 text-amber-900",
    dot: "bg-amber-500",
  },
  maintenance: {
    pill: "bg-slate-100 text-slate-700 border border-slate-200",
    tile: "border-slate-300 bg-slate-100 text-slate-700",
    dot: "bg-slate-500",
  },
};

const WARD_ACCENTS = [
  "border-rose-200 bg-rose-50/50",
  "border-blue-200 bg-blue-50/50",
  "border-violet-200 bg-violet-50/50",
  "border-cyan-200 bg-cyan-50/50",
  "border-emerald-200 bg-emerald-50/50",
  "border-amber-200 bg-amber-50/50",
];

export default function BedsPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [predictions, setPredictions] = useState<WardPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWardId, setSelectedWardId] = useState<number | "all">("all");
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [newStatus, setNewStatus] = useState<BedStatus>("available");
  const [reserveId, setReserveId] = useState("");
  const [updating, setUpdating] = useState(false);
  const [dischargeAt, setDischargeAt] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function getDefaultDischargeTime() {
    const value = new Date(Date.now() + 2 * 60 * 60 * 1000);
    value.setSeconds(0, 0);
    const offset = value.getTimezoneOffset() * 60_000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 16);
  }

  const loadData = useCallback(async () => {
    try {
      const [wardData, bedData, predictionData] = await Promise.all([
        getAllWards(),
        getAllBeds(),
        getWardPredictions(),
      ]);

      setWards(wardData);
      setBeds(bedData);
      setPredictions(predictionData);
      wardData.forEach((ward) => joinWard(ward.id));
    } finally {
      setLoading(false);
    }
  }, []);

  const { connectionState, isFallbackPolling, lastSyncAt, refreshNow } =
    useRealtimeSync({
      load: async () => {
        try {
          await loadData();
        } catch (error) {
          console.error("Failed to load bed map", error);
          setLoading(false);
        }
      },
      pollIntervalMs: 25000,
      staleAfterMs: 45000,
    });

  useEffect(() => {
    const socket = getSocket();
    const handler = () => {
      loadData().catch(() => {});
    };

    socket.on("bed_status_update", handler);
    socket.on("discharge_order_update", handler);

    return () => {
      socket.off("bed_status_update", handler);
      socket.off("discharge_order_update", handler);
    };
  }, [loadData]);

  const totalBeds = beds.length;
  const availableBeds = beds.filter((bed) => bed.status === "available").length;
  const occupiedBeds = beds.filter((bed) => bed.status === "occupied").length;
  const reservedBeds = beds.filter((bed) => bed.status === "reserved").length;

  const visibleWards =
    selectedWardId === "all"
      ? wards
      : wards.filter((ward) => ward.id === selectedWardId);

  function wardBeds(wardId: number) {
    return beds.filter((bed) => bed.ward_id === wardId);
  }

  function openBedDetails(bed: Bed) {
    setSelectedBed(bed);
    setNewStatus(bed.status);
    setReserveId("");
    setDischargeAt(getDefaultDischargeTime());
    setActionError(null);
  }

  async function handleUpdateStatus(overrideStatus?: BedStatus, overridePatientId?: number) {
    if (!selectedBed) return;

    setUpdating(true);
    setActionError(null);

    try {
      const statusToApply = overrideStatus ?? newStatus;
      const patientId =
        overridePatientId ??
        (statusToApply === "reserved" && reserveId ? Number(reserveId) : undefined);

      await updateBedStatus(selectedBed.id, statusToApply, patientId);
      setBeds((prev) =>
        prev.map((bed) =>
          bed.id === selectedBed.id ? { ...bed, status: statusToApply } : bed
        )
      );
      setNotice(`${selectedBed.number} updated to ${statusToApply}.`);
      setSelectedBed(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update bed status."
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleCreateDischargeOrder() {
    if (!selectedBed?.assigned_patient_id || !selectedBed.doctor_id || !dischargeAt) {
      setActionError("Patient, doctor, and expected discharge time are required.");
      return;
    }

    setUpdating(true);
    setActionError(null);
    try {
      await createDischargeOrder(
        selectedBed.assigned_patient_id,
        selectedBed.id,
        selectedBed.doctor_id,
        new Date(dischargeAt).toISOString()
      );
      setNotice(`Discharge scheduled for ${selectedBed.patient_name ?? "the patient"}.`);
      setSelectedBed(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not create discharge order."
      );
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center gap-3 rounded-[32px] border border-white/80 bg-white/95 shadow-[0_30px_70px_-50px_rgba(15,23,42,0.45)]">
        <Activity className="h-7 w-7 animate-spin text-blue-500" />
        <span className="font-medium text-slate-500">Loading bed allocation view...</span>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {notice && (
        <div className="rounded-[26px] border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700 shadow-sm">
          {notice}
        </div>
      )}

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

      {isFallbackPolling && (
        <div className="rounded-3xl border border-sky-100 bg-sky-50 px-5 py-3 text-sm text-sky-700 shadow-sm">
          Live ward events are temporarily unavailable. Bed allocation is staying current with automatic fallback refreshes.
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid flex-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            { title: "Total Beds", value: totalBeds, color: "text-slate-900" },
            { title: "Available", value: availableBeds, color: "text-emerald-600" },
            { title: "Occupied", value: occupiedBeds, color: "text-rose-600" },
            { title: "Reserved", value: reservedBeds, color: "text-amber-600" },
          ].map((card) => (
            <article
              key={card.title}
              className="rounded-[30px] border border-white/80 bg-white/95 px-6 py-7 text-center shadow-[0_30px_70px_-50px_rgba(15,23,42,0.45)]"
            >
              <p className={`text-5xl font-black tracking-tight ${card.color}`}>{card.value}</p>
              <p className="mt-3 text-base text-slate-500">{card.title}</p>
            </article>
          ))}
        </div>

        <button
          onClick={() => setNotice("Add Bed workflow can be connected once the create-bed API is introduced.")}
          className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:from-blue-700 hover:to-blue-600"
        >
          <Plus className="h-4 w-4" />
          Add Bed
        </button>
      </div>

      <div className="flex flex-col gap-4 rounded-[30px] border border-white/80 bg-white/95 px-5 py-4 shadow-[0_30px_70px_-50px_rgba(15,23,42,0.45)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-bold uppercase tracking-[0.28em] text-slate-500">Legend</span>
          {(["available", "occupied", "reserved", "maintenance"] as BedStatus[]).map((status) => (
            <div key={status} className="flex items-center gap-2 text-slate-600">
              <span className={`h-5 w-5 rounded-md ${STATUS_STYLES[status].tile}`} />
              <span className="capitalize">{status}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => refreshNow()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setSelectedWardId("all")}
          className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
            selectedWardId === "all"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
              : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          All
        </button>
        {wards.map((ward) => {
          const count = wardBeds(ward.id).length;
          return (
            <button
              key={ward.id}
              onClick={() => setSelectedWardId(ward.id)}
              className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                selectedWardId === ward.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {ward.name.replace(" Ward", "")} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {visibleWards.map((ward, index) => {
          const wardBedList = wardBeds(ward.id);
          const freeCount = wardBedList.filter((bed) => bed.status === "available").length;
          const occupiedCount = wardBedList.filter((bed) => bed.status === "occupied").length;
          const predictedFreeSoon =
            predictions.find((entry) => entry.ward_id === ward.id)?.predicted_free_beds ?? 0;

          return (
            <article
              key={ward.id}
              className={`rounded-[32px] border p-5 shadow-[0_30px_70px_-50px_rgba(15,23,42,0.45)] ${
                WARD_ACCENTS[index % WARD_ACCENTS.length]
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900">
                    {ward.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Real-time bed management across this ward · {predictedFreeSoon} predicted free soon
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-semibold text-emerald-700">{freeCount} free</span>
                  <span className="font-semibold text-rose-600">{occupiedCount} occupied</span>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-6">
                {wardBedList.map((bed) => (
                  <button
                    key={bed.id}
                    onClick={() => openBedDetails(bed)}
                    className={`relative rounded-[24px] border px-4 py-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${STATUS_STYLES[bed.status].tile}`}
                  >
                    {bed.status === "occupied" && (
                      <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-rose-500 ring-4 ring-white/90" />
                    )}
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                      <BedDouble className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-xl font-black tracking-tight">{bed.bed_number}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.28em] opacity-70">
                      {bed.status}
                    </p>
                    {bed.patient_initials && (
                      <p className="mt-3 inline-flex rounded-full bg-white/70 px-3 py-1 text-xs font-bold">
                        {bed.patient_initials}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      {selectedBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[36px] border border-white/70 bg-white shadow-[0_40px_120px_-48px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 px-6 py-5">
              <div>
                <h3 className="text-3xl font-black tracking-tight text-slate-900">
                  {selectedBed.bed_number}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{selectedBed.ward_name}</p>
              </div>
              <button
                onClick={() => setSelectedBed(null)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">
                  Current Status
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS_STYLES[selectedBed.status].pill}`}>
                  {selectedBed.status}
                </span>
              </div>

              {selectedBed.status === "occupied" && (
                <div className="space-y-4 rounded-[28px] border border-slate-100 bg-slate-50/90 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                        Patient
                      </p>
                      <p className="text-lg font-bold text-slate-900">
                        {selectedBed.patient_name ?? "Unknown patient"}
                      </p>
                    </div>
                  </div>

                  {selectedBed.admitted_since && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                          Admitted Since
                        </p>
                        <p className="text-lg font-bold text-slate-900">
                          {new Date(selectedBed.admitted_since).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedBed.assigned_doctor && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <Stethoscope className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                          Assigned Doctor
                        </p>
                        <p className="text-lg font-bold text-slate-900">
                          {selectedBed.assigned_doctor}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="rounded-[24px] border border-amber-100 bg-amber-50 p-4">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.28em] text-amber-700">
                      Schedule Discharge
                    </label>
                    <input
                      type="datetime-local"
                      value={dischargeAt}
                      onChange={(event) => setDischargeAt(event.target.value)}
                      className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                    />
                    <button
                      onClick={handleCreateDischargeOrder}
                      disabled={updating || !selectedBed.assigned_patient_id || !selectedBed.doctor_id || !dischargeAt}
                      className="mt-3 w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
                    >
                      {updating ? "Scheduling..." : "Create Discharge Order"}
                    </button>
                  </div>
                </div>
              )}

              {selectedBed.status === "available" && (
                <div className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-5">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.28em] text-emerald-700">
                    Reserve for Patient ID
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      placeholder="Patient ID"
                      value={reserveId}
                      onChange={(event) => setReserveId(event.target.value)}
                      className="flex-1 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    />
                    <button
                      onClick={() => handleUpdateStatus("reserved", Number(reserveId))}
                      disabled={!reserveId || updating}
                      className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Reserve
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.28em] text-slate-400">
                  Override Status
                </label>
                <select
                  value={newStatus}
                  onChange={(event) => setNewStatus(event.target.value as BedStatus)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                  <option value="maintenance">Maintenance</option>
                </select>
                <button
                  onClick={() => handleUpdateStatus()}
                  disabled={updating || newStatus === selectedBed.status}
                  className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-40"
                >
                  {updating ? "Updating..." : "Update Bed Status"}
                </button>
              </div>

              {actionError && (
                <div className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
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
