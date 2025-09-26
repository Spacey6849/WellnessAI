"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const loginRoles = [
  { label: "User", value: "user" },
  { label: "Admin", value: "admin" },
];

export default function LoginPage() {
  const [role, setRole] = useState<string>(loginRoles[0].value);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  // Basic focus management: move focus into dialog when mounted
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // Escape key closes (navigate back or home)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = "/";
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.92),rgba(2,6,23,0.94))] px-6 py-12 text-white"
      aria-labelledby="login-heading"
      aria-describedby="login-desc"
      role="dialog"
      aria-modal="true"
      ref={containerRef}
    >
      <div className="absolute inset-0 bg-[url('/window.svg')] bg-cover bg-center opacity-10" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/50 via-black/10 to-transparent" aria-hidden />

      <div className="relative w-full max-w-lg rounded-[36px] border border-white/10 bg-black/65 p-10 shadow-[0_28px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-2xl focus:outline-none" tabIndex={-1}>
        <Link
          href="/"
          aria-label="Close login dialog"
          className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-200 transition hover:border-white/30 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
        >
          <X className="h-4 w-4" />
        </Link>

        <div className="space-y-2 text-center">
          <h1 id="login-heading" className="text-3xl font-semibold tracking-tight">
            Welcome Back!
          </h1>
          <p id="login-desc" className="text-sm text-slate-300">
            Sign in to continue your journey.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              Login as
            </p>
            <div className="grid grid-cols-2 gap-3">
              {loginRoles.map(({ label, value }) => {
                const isActive = role === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      isActive
                        ? "border border-blue-500/60 bg-blue-500/20 text-white shadow-[0_10px_30px_-18px_rgba(59,130,246,0.9)]"
                        : "border border-white/10 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <label htmlFor="login-identifier" className="block text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Email or Username
          </label>
          <input
            id="login-identifier"
            ref={firstFieldRef}
            type="text"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email or username"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/25"
          />

          <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Password
          </label>
          <div className="relative mt-2">
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/25"
            />
            <Link
              href="#"
              className="absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-slate-200 transition hover:text-white"
            >
              Forgot?
            </Link>
          </div>

          <button
            type="button"
            className="w-full rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(59,130,246,0.8)] transition hover:-translate-y-0.5 hover:from-blue-500 hover:via-blue-500 hover:to-blue-600"
          >
            Log In
          </button>
        </div>

        <div className="mt-10 text-center text-sm text-slate-300">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-white hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
