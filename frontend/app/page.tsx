import Link from "next/link";
import { 
  Activity, 
  LayoutDashboard, 
  Stethoscope, 
  UserPlus, 
  BedDouble, 
  Clock, 
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  HeartPulse,
  Users
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 selection:bg-indigo-100 selection:text-indigo-700">
      {/* ── Hero Section ── */}
      <section className="pt-24 pb-20 px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Enterprise Healthcare Management</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-slate-800 leading-[1.1] tracking-tight">
              Hospital management, <span className="text-indigo-600">reimagined</span> for speed.
            </h1>
            <p className="text-lg text-slate-500 max-w-lg font-medium leading-relaxed">
              ITERYX provides real-time visibility into bed map availability, AI-powered triage scoring, and prioritized doctor queues.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <a 
                href="#portal" 
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold flex items-center gap-3 transition shadow-xl shadow-indigo-100"
              >
                Access Portal <ChevronRight className="w-5 h-5" />
              </a>
              <div className="flex -space-x-3 items-center">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200" />
                ))}
                <span className="pl-6 text-sm font-bold text-slate-400">+12 Staff Online</span>
              </div>
            </div>
          </div>
          
          <div className="relative group">
            <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full group-hover:bg-indigo-500/20 transition-all duration-700" />
            <div className="relative bg-white rounded-[40px] border border-slate-100 p-8 shadow-2xl space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Occupancy</p>
                  <p className="text-4xl font-black text-slate-800">84%</p>
                </div>
                <div className="h-12 w-24 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-500" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-4 bg-slate-50 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[84%] rounded-full shadow-lg shadow-indigo-200" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-3xl space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Available Beds</p>
                    <p className="text-xl font-bold text-slate-700">12</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-3xl space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Critical Queue</p>
                    <p className="text-xl font-bold text-rose-500">2</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── System Access Portal ── */}
      <section id="portal" className="py-20 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">System Modules</h2>
            <p className="text-slate-500 font-medium">Select a department to continue to the specific portal</p>
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
          
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8 pt-12 border-t border-slate-50">
            <Link href="/admin/beds" className="flex items-center gap-4 group">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 transition-all">
                <BedDouble className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
              </div>
              <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Bed Map</span>
            </Link>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-slate-600" />
              </div>
              <span className="text-sm font-bold text-slate-600">Pending Discharge</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
              <span className="text-sm font-bold text-slate-600">Staff Management</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <HeartPulse className="w-5 h-5 text-slate-600" />
              </div>
              <span className="text-sm font-bold text-slate-600">Health Alerts</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 px-8 text-center bg-slate-50">
        <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
          <Activity className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-black tracking-widest uppercase">ITERYX HOSPITAL SYSTEMS</span>
        </div>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">© 2026 ITERYX Healthcare Services • AI Prioritization Enabled</p>
      </footer>
    </main>
  );
}
