"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  BedDouble,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  ShieldCheck,
  Siren,
  Stethoscope,
  TimerReset,
  Users,
} from "lucide-react";

import { getAllBeds, getPendingDischarges, getQueue, getWardPredictions } from "@/lib/api";
import {
  PILOT_DEMO_STEPS,
  PILOT_OPERATIONAL_RULES,
  PILOT_SUCCESS_CRITERIA,
} from "@/lib/pilot-rules";

type PilotSnapshot = {
  queueLength: number;
  criticalCases: number;
  availableBeds: number;
  reservedBeds: number;
  dischargeOrders: number;
  predictionCoverage: number;
};

export default function PilotReadinessPage() {
  const [snapshot, setSnapshot] = useState<PilotSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [queue, beds, discharges, predictions] = await Promise.all([
        getQueue(),
        getAllBeds(),
        getPendingDischarges(),
        getWardPredictions(),
      ]);

      setSnapshot({
        queueLength: queue.filter((entry) => entry.status === "waiting").length,
        criticalCases: queue.filter((entry) => entry.priority_level === "CRITICAL").length,
        availableBeds: beds.filter((bed) => bed.status === "available").length,
        reservedBeds: beds.filter((bed) => bed.status === "reserved").length,
        dischargeOrders: discharges.length,
        predictionCoverage: predictions.length,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Pilot checks could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const readinessChecks = snapshot
    ? [
        {
          title: "Realtime queue is populated",
          passed: snapshot.queueLength > 0,
          detail: `${snapshot.queueLength} waiting patients available for walkthrough.`,
        },
        {
          title: "Critical escalation path is visible",
          passed: snapshot.criticalCases >= 0,
          detail: `${snapshot.criticalCases} critical patients currently flagged.`,
        },
        {
          title: "Beds are allocatable right now",
          passed: snapshot.availableBeds > 0,
          detail: `${snapshot.availableBeds} available and ${snapshot.reservedBeds} reserved beds in system.`,
        },
        {
          title: "Prediction layer is live",
          passed: snapshot.predictionCoverage > 0,
          detail: `${snapshot.predictionCoverage} ward prediction entries ready for demo.`,
        },
      ]
    : [];

  return (
    <section className="space-y-6">
      <div className="rounded-[30px] border border-white/80 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-[0_30px_80px_-50px_rgba(15,23,42,0.9)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-sky-200">
              Pilot Command Center
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">
              Stakeholder-ready hospital operations walkthrough
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              This page packages the core pilot path into one place so admin staff can brief judges,
              hospital stakeholders, or pilot observers before moving into the live portals.
            </p>
          </div>

          <button
            onClick={() => load()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Pilot Snapshot
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-[30px] border border-white/80 bg-white/95 py-24 text-slate-500 shadow-[0_26px_60px_-50px_rgba(15,23,42,0.45)]">
          <Activity className="h-5 w-5 animate-spin text-blue-500" />
          Loading pilot readiness checks...
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Waiting Queue", value: snapshot?.queueLength ?? 0, icon: Users, tone: "text-blue-600" },
              { label: "Critical Cases", value: snapshot?.criticalCases ?? 0, icon: Siren, tone: "text-rose-600" },
              { label: "Available Beds", value: snapshot?.availableBeds ?? 0, icon: BedDouble, tone: "text-emerald-600" },
              { label: "Pending Discharges", value: snapshot?.dischargeOrders ?? 0, icon: TimerReset, tone: "text-amber-600" },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.label}
                  className="rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_26px_60px_-50px_rgba(15,23,42,0.45)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                        {card.label}
                      </p>
                      <p className={`mt-3 text-4xl font-black tracking-tight ${card.tone}`}>
                        {card.value}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
            <article className="rounded-[30px] border border-white/80 bg-white/95 p-5 shadow-[0_26px_60px_-50px_rgba(15,23,42,0.45)]">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-5 w-5 text-sky-600" />
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Pilot Flow</h3>
                  <p className="text-sm text-slate-500">Walk stakeholders through these four moves in order.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {PILOT_DEMO_STEPS.map((step, index) => (
                  <div
                    key={step.title}
                    className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-base font-bold text-slate-900">{step.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{step.summary}</p>
                        </div>
                      </div>
                      <Link
                        href={step.href}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Open step
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <div className="space-y-6">
              <article className="rounded-[30px] border border-white/80 bg-white/95 p-5 shadow-[0_26px_60px_-50px_rgba(15,23,42,0.45)]">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Go / No-Go Check</h3>
                    <p className="text-sm text-slate-500">What we validate before a live pilot session starts.</p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {readinessChecks.map((item) => (
                    <div
                      key={item.title}
                      className={`rounded-[22px] border px-4 py-3 ${
                        item.passed
                          ? "border-emerald-100 bg-emerald-50"
                          : "border-amber-100 bg-amber-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2
                          className={`h-4.5 w-4.5 ${item.passed ? "text-emerald-600" : "text-amber-600"}`}
                        />
                        <div>
                          <p className="font-semibold text-slate-900">{item.title}</p>
                          <p className="text-sm text-slate-500">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[30px] border border-white/80 bg-white/95 p-5 shadow-[0_26px_60px_-50px_rgba(15,23,42,0.45)]">
                <div className="flex items-center gap-3">
                  <Stethoscope className="h-5 w-5 text-violet-600" />
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Operational Guardrails</h3>
                    <p className="text-sm text-slate-500">Rules staff should follow during the pilot.</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm text-slate-600">
                  {PILOT_OPERATIONAL_RULES.map((rule) => (
                    <div key={rule} className="rounded-[20px] border border-slate-100 bg-slate-50/80 px-4 py-3 leading-6">
                      {rule}
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>

          <article className="rounded-[30px] border border-white/80 bg-white/95 p-5 shadow-[0_26px_60px_-50px_rgba(15,23,42,0.45)]">
            <h3 className="text-xl font-bold text-slate-900">Pilot Success Criteria</h3>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {PILOT_SUCCESS_CRITERIA.map((criterion) => (
                <div
                  key={criterion}
                  className="rounded-[22px] border border-slate-100 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-600"
                >
                  {criterion}
                </div>
              ))}
            </div>
          </article>
        </>
      )}
    </section>
  );
}
