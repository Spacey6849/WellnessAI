"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface BaseFieldProps {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}

function Field({ label, type = "text", placeholder, value, onChange, autoFocus }: BaseFieldProps) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
      {label}
      <input
        autoFocus={autoFocus}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/25"
      />
    </label>
  );
}

export function AuthModal() {
  const params = useSearchParams();
  const mode = params.get("auth"); // login | signup | null
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [identifier, setIdentifier] = useState(""); // email or username
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [authRole, setAuthRole] = useState<'user' | 'admin'>('user');

  const close = useCallback(() => {
    const usp = new URLSearchParams(Array.from(params.entries()));
    usp.delete("auth");
    router.push("/?" + usp.toString(), { scroll: false });
  }, [params, router]);

  useEffect(() => {
    if (!mode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, close]);

  useEffect(() => {
    if (mode && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [mode]);

  // Force role to 'user' for signup flow (admin accounts created manually via backend)
  useEffect(() => {
    if (mode === 'signup' && authRole !== 'user') {
      setAuthRole('user');
    }
  }, [mode, authRole]);

  if (!mode) return null;

  const isSignup = mode === "signup";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-10 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={isSignup ? "Sign up form" : "Log in form"}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-xl rounded-[36px] border border-white/10 bg-slate-900/80 p-10 shadow-[0_28px_80px_-34px_rgba(0,0,0,0.9)] outline-none"
      >
        <button
          onClick={close}
            aria-label="Close auth dialog"
          className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-200 transition hover:border-white/30 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            {isSignup ? "Create Account" : "Welcome Back!"}
          </h1>
          <p className="text-sm text-slate-300">
            {isSignup ? "Sign up with your email and choose a unique username." : "Log in using your email or username."}
          </p>
          {!isSignup && (
            <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-xs font-semibold" role="tablist" aria-label="Authentication role">
              {(['user','admin'] as const).map(r => {
                const active = r === authRole;
                return (
                  <button
                    key={r}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={()=> setAuthRole(r)}
                    className={`rounded-full px-5 py-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 ${active ? (r==='admin' ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow' : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow') : 'text-slate-300 hover:text-white'}`}
                  >
                    <span className="uppercase tracking-[0.3em]">{r}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <form
          className="mt-8 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            // Placeholder submit logic
            close();
          }}
        >
          {isSignup && (
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Full name" placeholder="Jane Doe" value={fullName} onChange={setFullName} autoFocus />
              <Field label="Username" placeholder="unique name" value={username} onChange={setUsername} />
            </div>
          )}
          {!isSignup && (
            <Field
              label="Email or Username"
              placeholder="you@example.com or handle"
              value={identifier}
              onChange={setIdentifier}
              autoFocus
            />
          )}
          {isSignup && (
            <Field
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={identifier}
              onChange={setIdentifier}
              autoFocus={!fullName && !username}
            />
          )}
          <Field
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
          />
          {isSignup && (
            <Field
              label="Confirm password"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={setConfirm}
            />
          )}

          <button
            type="submit"
            className={`w-full rounded-full px-6 py-3 text-sm font-semibold text-white transition shadow-[0_18px_40px_-18px_rgba(59,130,246,0.8)] ${(authRole==='admin') ? 'shadow-fuchsia-500/40' : ''} ${
              isSignup
                ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-600 hover:-translate-y-0.5 hover:from-emerald-500 hover:via-emerald-500 hover:to-emerald-600"
                : authRole==='admin'
                  ? "bg-gradient-to-r from-fuchsia-500 via-fuchsia-400 to-purple-600 hover:-translate-y-0.5 hover:from-fuchsia-500 hover:via-fuchsia-500 hover:to-purple-600"
                  : "bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 hover:-translate-y-0.5 hover:from-blue-500 hover:via-blue-500 hover:to-blue-600"
            }`}
          >
            {isSignup ? "Sign Up" : authRole==='admin' ? 'Admin Log In' : 'Log In'}
          </button>

          <p className="text-center text-sm text-slate-300">
            {isSignup ? (
              <>Already have an account? <button type="button" onClick={() => router.push("/?auth=login", { scroll: false })} className="font-semibold text-white hover:underline">Log in</button></>
            ) : (
              <>Don&apos;t have an account? <button type="button" onClick={() => router.push("/?auth=signup", { scroll: false })} className="font-semibold text-white hover:underline">Sign up</button></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
