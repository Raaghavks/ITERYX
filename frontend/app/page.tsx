import Link from "next/link";
import {
  Activity,
  BedDouble,
  ChevronRight,
  HeartPulse,
  LayoutDashboard,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 selection:bg-indigo-100 selection:text-indigo-700">
      <section className="mx-auto max-w-7xl px-8 pb-20 pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Enterprise Healthcare Management
              </span>
            </div>

            <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-slate-800 md:text-7xl">
              Hospital management, <span className="text-indigo-600">reimagined</span> for speed.
            </h1>

            <p className="max-w-lg text-lg font-medium leading-relaxed text-slate-500">
              ITERYX gives care teams a single workspace for real-time bed visibility,
              AI-assisted triage, doctor queue management, and discharge coordination.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/login"
                className="flex items-center gap-3 rounded-2xl bg-indigo-600 px-8 py-4 font-bold text-white shadow-xl shadow-indigo-100 transition hover:bg-indigo-700"
              >
                Access Portal <ChevronRight className="h-5 w-5" />
              </Link>

              <div className="flex items-center -space-x-3">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-10 w-10 rounded-full border-2 border-white bg-slate-200"
                  />
                ))}
                <span className="pl-6 text-sm font-bold text-slate-400">
                  +12 staff online
                </span>
              </div>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-3xl transition-all duration-700 group-hover:bg-indigo-500/20" />
            <div className="relative space-y-6 rounded-[40px] border border-slate-100 bg-white p-8 shadow-2xl">
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Global Occupancy
                  </p>
                  <p className="text-4xl font-black text-slate-800">84%</p>
                </div>
                <div className="flex h-12 w-24 items-center justify-center rounded-xl bg-emerald-50">
                  <Activity className="h-6 w-6 text-emerald-500" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="h-4 overflow-hidden rounded-full bg-slate-50">
                  <div className="h-full w-[84%] rounded-full bg-indigo-500 shadow-lg shadow-indigo-200" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 rounded-3xl bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      Available Beds
                    </p>
                    <p className="text-xl font-bold text-slate-700">12</p>
                  </div>
                  <div className="space-y-1 rounded-3xl bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      Critical Queue
                    </p>
                    <p className="text-xl font-bold text-rose-500">2</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="portal" className="border-y border-slate-100 bg-white py-20">
        <div className="mx-auto max-w-7xl px-8">
          <div className="mb-16 space-y-4 text-center">
            <h2 className="text-3xl font-black tracking-tight text-slate-800">
              System Modules
            </h2>
            <p className="font-medium text-slate-500">
              Each hospital role gets a focused workspace with the right tools.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Admin Dashboard */}
            <Link href="/admin/dashboard" className="group p-2 bg-slate-50 rounded-[32px] border border-slate-100 hover:border-indigo-200 transition-all duration-500">
              <div className="bg-white rounded-[24px] p-8 space-y-6 shadow-sm border border-slate-100 group-hover:shadow-xl transition-all">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  <LayoutDashboard className="w-8 h-8 text-amber-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">Admin Dashboard</h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">
                    Overview of hospital KPIs, real-time occupancy charts, and emergency alert feed.
                  </p>
                </div>
                <div className="flex items-center text-slate-400 font-bold text-xs uppercase tracking-widest gap-2 group-hover:text-indigo-600 transition-colors">
                  Enter Dashboard <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
            {/* Doctor Portal */}
            <Link href="/doctor/queue" className="group p-2 bg-slate-50 rounded-[32px] border border-slate-100 hover:border-indigo-200 transition-all duration-500">
              <div className="bg-white rounded-[24px] p-8 space-y-6 shadow-sm border border-slate-100 group-hover:shadow-xl transition-all">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  <Stethoscope className="w-8 h-8 text-blue-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">Doctor Queue</h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">
                    Prioritized patient queue with AI triage scoring and real-time consult status.
                  </p>
                </div>
                <div className="flex items-center text-slate-400 font-bold text-xs uppercase tracking-widest gap-2 group-hover:text-indigo-600 transition-colors">
                  Open Queue <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </Link>

            {/* OPD Registration */}
            <Link href="/opd/register" className="group p-2 bg-slate-50 rounded-[32px] border border-slate-100 hover:border-indigo-200 transition-all duration-500">
              <div className="bg-white rounded-[24px] p-8 space-y-6 shadow-sm border border-slate-100 group-hover:shadow-xl transition-all">
                <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  <UserPlus className="w-8 h-8 text-teal-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">OPD Registration</h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">
                    Patient admission portal with vital tracking and automatic triage assignment.
                  </p>
                </div>
                <div className="flex items-center text-slate-400 font-bold text-xs uppercase tracking-widest gap-2 group-hover:text-indigo-600 transition-colors">
                  Patient Intake <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </Link>

            <Link href="/admin/pilot" className="group p-2 bg-slate-50 rounded-[32px] border border-slate-100 hover:border-indigo-200 transition-all duration-500">
              <div className="bg-white rounded-[24px] p-8 space-y-6 shadow-sm border border-slate-100 group-hover:shadow-xl transition-all">
                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  <ShieldCheck className="w-8 h-8 text-rose-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">Pilot Readiness</h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">
                    Guided stakeholder demo flow, operational guardrails, and live go/no-go readiness checks.
                  </p>
                </div>
                <div className="flex items-center text-slate-400 font-bold text-xs uppercase tracking-widest gap-2 group-hover:text-indigo-600 transition-colors">
                  Launch Pilot View <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-8 border-t border-slate-50 pt-12 md:grid-cols-4">
            <Link href="/login" className="group flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 transition-all group-hover:bg-indigo-600">
                <BedDouble className="h-5 w-5 text-slate-600 transition-colors group-hover:text-white" />
              </div>
              <span className="text-sm font-bold text-slate-600 transition-colors group-hover:text-indigo-600">
                Bed Map
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                <HeartPulse className="h-5 w-5 text-slate-600" />
              </div>
              <span className="text-sm font-bold text-slate-600">Discharge Planning</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                <Users className="h-5 w-5 text-slate-600" />
              </div>
              <span className="text-sm font-bold text-slate-600">Staff Coordination</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                <Activity className="h-5 w-5 text-slate-600" />
              </div>
              <span className="text-sm font-bold text-slate-600">Live Alerts</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-50 px-8 py-12 text-center">
        <div className="mb-4 flex items-center justify-center gap-2 opacity-50">
          <Activity className="h-4 w-4 text-indigo-600" />
          <span className="text-xs font-black uppercase tracking-widest">
            ITERYX Hospital Systems
          </span>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          © 2026 ITERYX Healthcare Services · AI prioritization enabled
        </p>
      </footer>
    </main>
  );
}
