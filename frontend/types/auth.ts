export type AuthRole = "administrator" | "doctor" | "receptionist";

export interface AuthSessionUser {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  title: string;
  department: string;
  avatarInitials: string;
}

export interface DemoLoginUser extends AuthSessionUser {
  password: string;
}
