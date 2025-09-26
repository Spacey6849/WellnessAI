"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const binCategories = [
  { label: "Private", value: "private" },
  { label: "Public", value: "public" },
];

export default function SignupPage() {
  const [category, setCategory] = useState<string>(binCategories[0].value);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

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
      className="relative flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.95),rgba(2,6,23,0.94))] px-6 py-12 text-white"
      aria-labelledby="signup-heading"
      aria-describedby="signup-desc"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-[url('/window.svg')] bg-cover bg-center opacity-10" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/50 via-black/15 to-transparent" aria-hidden />

      <div className="relative w-full max-w-2xl rounded-[36px] border border-white/10 bg-black/65 p-12 shadow-[0_32px_90px_-35px_rgba(15,23,42,0.95)] backdrop-blur-2xl" tabIndex={-1}>
        <Link
          href="/"
          aria-label="Close signup dialog"
          className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-200 transition hover:border-white/30 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
        >
          <X className="h-4 w-4" />
        </Link>

        <div className="space-y-3 text-center">
          <h1 id="signup-heading" className="text-3xl font-semibold tracking-tight">Create Account</h1>
          <p id="signup-desc" className="text-sm text-slate-300">Join us and explore the world.</p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              Registering as bin owner
            </p>
            <div className="grid grid-cols-2 gap-3">
              {binCategories.map(({ label, value }) => {
                const isActive = category === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      isActive
                        ? "border border-emerald-500/60 bg-emerald-500/20 text-white shadow-[0_12px_36px_-18px_rgba(34,197,94,0.75)]"
                        : "border border-white/10 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <form className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Full name
                <input
                  ref={firstFieldRef}
                  type="text"
                  placeholder="John Doe"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/25"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Username
                <input
                  type="text"
                  placeholder="unique name"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/25"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Location
                <input
                  type="text"
                  placeholder="District / State"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/25"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Email address
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/25"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Phone number
                <input
                  type="tel"
                  placeholder="+1 555 123 4567"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/25"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Password
                <input
                  type="password"
                  placeholder="••••••••"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/25"
                />
              </label>
            </div>

            <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              Confirm password
              <input
                type="password"
                placeholder="••••••••"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/25"
              />
            </label>

            <button
              type="button"
              className="w-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_44px_-22px_rgba(34,197,94,0.8)] transition hover:-translate-y-0.5 hover:from-emerald-500 hover:via-emerald-500 hover:to-emerald-600"
            >
              Sign Up
            </button>
          </form>
        </div>

        <div className="mt-12 text-center text-sm text-slate-300">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-white hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
