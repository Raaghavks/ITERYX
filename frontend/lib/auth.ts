import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEMO_USERS, defaultRouteForRole } from "@/lib/auth-config";
import type { AuthRole, AuthSessionUser } from "@/types/auth";

export const SESSION_COOKIE_NAME = "iteryx_session";

const SESSION_DURATION_SECONDS = 60 * 60 * 12;
const AUTH_SECRET = process.env.AUTH_SESSION_SECRET || "iteryx-dev-auth-secret";

function signValue(payload: string): string {
  return createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
}

function encodeSession(user: AuthSessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

function decodeSession(token: string): AuthSessionUser | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = signValue(payload);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as AuthSessionUser;
  } catch {
    return null;
  }
}

export function authenticateWithCredentials(
  email: string,
  password: string
): AuthSessionUser | null {
  const user = DEMO_USERS.find(
    (candidate) =>
      candidate.email.toLowerCase() === email.trim().toLowerCase() &&
      candidate.password === password
  );

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    department: user.department,
    avatarInitials: user.avatarInitials,
  };
}

export function createSessionCookieValue(user: AuthSessionUser): string {
  return encodeSession(user);
}

export async function getCurrentSession(): Promise<AuthSessionUser | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return decodeSession(token);
}

export async function requireSession(
  allowedRoles?: AuthRole[]
): Promise<AuthSessionUser> {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(session.role) &&
    session.role !== "administrator"
  ) {
    redirect(defaultRouteForRole(session.role));
  }

  return session;
}

export function getSessionDurationSeconds(): number {
  return SESSION_DURATION_SECONDS;
}
