"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

type DemoCredential = {
  email: string;
  password: string;
  label: string;
};

type LoginFormProps = {
  demoUsers: DemoCredential[];
};

export function LoginForm({ demoUsers }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(demoUsers[0]?.email ?? "");
  const [password, setPassword] = useState(demoUsers[0]?.password ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to sign in.");
      }

      router.push(payload.redirectTo || "/admin/dashboard");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to sign in."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {demoUsers.map((demoUser) => (
          <button
            key={demoUser.email}
            type="button"
            onClick={() => {
              setEmail(demoUser.email);
              setPassword(demoUser.password);
              setError(null);
            }}
            className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
              email === demoUser.email
                ? "border-sky-200 bg-sky-50 text-sky-900"
                : "border-slate-200 bg-slate-50/80 text-slate-600 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <p className="font-semibold">{demoUser.label}</p>
            <p className="mt-1 text-xs opacity-80">{demoUser.email}</p>
          </button>
        ))}
      </div>

      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
          Email
        </label>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          placeholder="admin@medicarehms.local"
          type="email"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
          Password
        </label>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          placeholder="Admin@123"
          type="password"
          required
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-700 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-sky-200 transition hover:from-sky-600 hover:to-blue-800 disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            Continue to dashboard
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
