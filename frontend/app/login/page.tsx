import { redirect } from "next/navigation";
import { Activity, ArrowRight, ShieldCheck, Stethoscope, UserRoundPlus } from "lucide-react";

import { DEMO_USERS, ROLE_LABELS } from "@/lib/auth-config";
import { getCurrentSession } from "@/lib/auth";
import { LoginForm } from "@/components/portal/LoginForm";

const ROLE_ICONS = {
  administrator: ShieldCheck,
  doctor: Stethoscope,
  receptionist: UserRoundPlus,
};

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect(
      session.role === "administrator"
        ? "/admin/dashboard"
        : session.role === "doctor"
          ? "/doctor/queue"
          : "/opd/register"
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.18),_transparent_30%),linear-gradient(180deg,#f8fbff_0%,#eef5ff_48%,#f8fafc_100%)] px-6 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between rounded-[36px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(241,247,255,0.92))] p-8 shadow-[0_40px_120px_-56px_rgba(15,23,42,0.35)] backdrop-blur-xl lg:p-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.28em] text-sky-700">
              <Activity className="h-4 w-4" />
              Hospital Command Center
            </div>
            <h1 className="mt-8 max-w-2xl text-5xl font-black tracking-tight text-slate-950 lg:text-6xl">
              Elegant access control for every care operations role.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Sign in as an administrator, doctor, or front desk operator to open a role-aware hospital workspace with live triage, bed operations, and discharge tracking.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {DEMO_USERS.map((user) => {
              const Icon = ROLE_ICONS[user.role];
              return (
                <div
                  key={user.id}
                  className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_30px_70px_-52px_rgba(15,23,42,0.4)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-50 to-blue-100 text-sky-700">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-lg font-bold text-slate-900">{user.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{ROLE_LABELS[user.role]}</p>
                  <div className="mt-5 space-y-1 text-sm text-slate-600">
                    <p>{user.email}</p>
                    <p className="font-semibold text-slate-900">{user.password}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex items-center">
          <div className="w-full rounded-[36px] border border-white/70 bg-white/92 p-8 shadow-[0_40px_120px_-56px_rgba(15,23,42,0.35)] backdrop-blur-xl lg:p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-sky-200">
                <Activity className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.32em] text-slate-400">
                  MediCare HMS
                </p>
                <h2 className="text-3xl font-black text-slate-950">Portal Login</h2>
              </div>
            </div>

            <div className="mt-8 rounded-[28px] border border-sky-100 bg-sky-50/80 p-5 text-sm text-sky-900">
              <div className="flex items-center gap-2 font-bold">
                <ArrowRight className="h-4 w-4" />
                Demo access is ready to use
              </div>
              <p className="mt-2 leading-6 text-sky-800/90">
                Choose one of the demo accounts on the left or enter the credentials manually to preview the correct role experience.
              </p>
            </div>

            <div className="mt-8">
              <LoginForm
                demoUsers={DEMO_USERS.map((user) => ({
                  email: user.email,
                  password: user.password,
                  label: `${ROLE_LABELS[user.role]} access`,
                }))}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
