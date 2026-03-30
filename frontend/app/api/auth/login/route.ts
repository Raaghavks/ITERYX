import { NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  authenticateWithCredentials,
  createSessionCookieValue,
  getSessionDurationSeconds,
} from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/auth-config";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  const sessionUser = authenticateWithCredentials(email, password);

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    success: true,
    user: sessionUser,
    redirectTo: defaultRouteForRole(sessionUser.role),
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionCookieValue(sessionUser),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionDurationSeconds(),
  });

  return response;
}
