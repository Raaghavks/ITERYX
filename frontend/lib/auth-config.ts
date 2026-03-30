import type { DemoLoginUser, AuthRole } from "@/types/auth";

export const DEMO_USERS: DemoLoginUser[] = [
  {
    id: "admin-01",
    name: "Rohith Vangappalayam T",
    email: "admin@medicarehms.local",
    password: "Admin@123",
    role: "administrator",
    title: "Administrator",
    department: "Hospital Operations",
    avatarInitials: "RVT",
  },
  {
    id: "doctor-01",
    name: "Dr. Aisha Raman",
    email: "doctor@medicarehms.local",
    password: "Doctor@123",
    role: "doctor",
    title: "Duty Physician",
    department: "Emergency Medicine",
    avatarInitials: "AR",
  },
  {
    id: "reception-01",
    name: "Priya Sharma",
    email: "reception@medicarehms.local",
    password: "Reception@123",
    role: "receptionist",
    title: "Front Desk Lead",
    department: "Patient Intake",
    avatarInitials: "PS",
  },
];

export const ROLE_LABELS: Record<AuthRole, string> = {
  administrator: "Administrator",
  doctor: "Doctor",
  receptionist: "Reception",
};

export function defaultRouteForRole(role: AuthRole): string {
  if (role === "administrator") return "/admin/dashboard";
  if (role === "doctor") return "/doctor/queue";
  return "/opd/register";
}
