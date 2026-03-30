"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  ArrowRightLeft,
  BedDouble,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  MonitorSmartphone,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";

import { ROLE_LABELS } from "@/lib/auth-config";
import type { AuthRole, AuthSessionUser } from "@/types/auth";

type PortalShellProps = {
  user: AuthSessionUser;
  children: React.ReactNode;
};

type NavItem = {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AuthRole[];
  disabled?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, roles: ["administrator"] },
  { label: "Patients", href: "/opd/register", icon: Users, roles: ["administrator", "receptionist"] },
  { label: "Bed Allocation", href: "/admin/beds", icon: BedDouble, roles: ["administrator", "doctor"] },
  { label: "Staff", icon: Stethoscope, roles: ["administrator"], disabled: true },
  { label: "Appointments", icon: CalendarDays, roles: ["administrator"], disabled: true },
  { label: "Emergency", href: "/doctor/queue", icon: ShieldAlert, roles: ["administrator", "doctor"] },
];

const PAGE_TITLES: Array<{ match: string; label: string; kicker: string }> = [
  { match: "/admin/dashboard", label: "Hospital Dashboard", kicker: "Live Overview" },
  { match: "/admin/beds", label: "Bed Allocation", kicker: "Operational Bed Control" },
  { match: "/doctor/queue", label: "Doctor Queue", kicker: "Clinical Triage Flow" },
  { match: "/opd/register", label: "Patient Intake", kicker: "Registration & Triage" },
];

export function PortalShell({ user, children }: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const visibleNav = NAV_ITEMS.filter(
    (item) => item.roles.includes(user.role) || user.role === "administrator"
  );

  const pageMeta =
    PAGE_TITLES.find((item) => pathname.startsWith(item.match)) ??
    PAGE_TITLES[0];

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_30%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_48%,#f7fafc_100%)] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden xl:flex w-[280px] flex-col border-r border-slate-200/70 bg-white/88 px-4 py-5 backdrop-blur-xl">
          <div className="flex items-center gap-3 rounded-[24px] border border-slate-200/80 bg-white px-4 py-4 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-sky-200">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-sky-500">
                Care Operations
              </p>
              <h2 className="text-xl font-black tracking-tight text-slate-900">
                MediCare HMS
              </h2>
            </div>
          </div>

          <nav className="mt-5 space-y-1.5">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = item.href ? pathname.startsWith(item.href) : false;

              if (!item.href || item.disabled) {
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] text-slate-400"
                  >
                    <Icon className="h-4.5 w-4.5" />
                    <span className="font-semibold">{item.label}</span>
                    <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Soon
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] transition-all ${
                    active
                      ? "bg-gradient-to-r from-blue-50 to-sky-50 text-blue-700 shadow-[0_16px_30px_-28px_rgba(37,99,235,0.95)] ring-1 ring-blue-100"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  <span className="font-semibold">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-4">
            <div className="rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 px-4 py-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-100 to-violet-100 text-sm font-black text-violet-700">
                  {user.avatarInitials}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.department}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                  {ROLE_LABELS[user.role]}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Active
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200/60 bg-white/72 px-5 py-4 backdrop-blur-xl sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                  <ArrowRightLeft className="h-4 w-4 rotate-90 text-slate-400" />
                  <span>/{pageMeta.label.replace("Hospital ", "")}</span>
                </div>
                <h1 className="mt-2 text-[2.1rem] font-black tracking-tight text-slate-900">
                  {pageMeta.label}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {new Date().toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  &middot; {pageMeta.kicker}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
                  <Sparkles className="h-4 w-4 text-sky-500" />
                  Role-aware portal session
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
                  <MonitorSmartphone className="h-4 w-4 text-violet-500" />
                  Elegant ops dashboard
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-5 sm:px-7">{children}</main>
        </div>
      </div>
    </div>
  );
}
