"use client";
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from '@/lib/useSession';

interface AuthOverlayContextValue {
  open: (mode: 'login' | 'signup') => void;
  close: () => void;
  mode: 'login' | 'signup' | null;
}

const AuthOverlayContext = createContext<AuthOverlayContextValue | undefined>(undefined);

export function AuthOverlayProvider({ children }: { children: React.ReactNode }) {
  const search = useSearchParams();
  const router = useRouter();
  const urlMode = (search.get('auth') === 'login' || search.get('auth') === 'signup') ? search.get('auth') as 'login' | 'signup' : null;
  const [mode, setMode] = useState<'login' | 'signup' | null>(urlMode);

  useEffect(() => { setMode(urlMode); }, [urlMode]);

  const open = useCallback((m: 'login' | 'signup') => {
    const params = new URLSearchParams(Array.from(search.entries()));
    params.set('auth', m);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, search]);

  const close = useCallback(() => {
    const params = new URLSearchParams(Array.from(search.entries()));
    params.delete('auth');
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, search]);

  return (
    <AuthOverlayContext.Provider value={{ open, close, mode }}>
      {children}
      <AuthModal mode={mode} onClose={close} />
    </AuthOverlayContext.Provider>
  );
}

export function useAuthOverlay() {
  const ctx = useContext(AuthOverlayContext);
  if (!ctx) throw new Error('useAuthOverlay must be used within AuthOverlayProvider');
  return ctx;
}

function AuthModal({ mode, onClose }: { mode: 'login' | 'signup' | null; onClose: () => void }) {
  const { session, signIn, signOut, status } = useSession();
  // Shared form state
  const [usernameOrEmail, setUsernameOrEmail] = useState(''); // login field (username/email)
  const [password, setPassword] = useState('');
  // Signup-specific fields
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (mode) {
      setUsernameOrEmail('');
      setPassword('');
      setSignupUsername('');
      setSignupEmail('');
      setPhone('');
      setError(null);
      setForgotMode(false);
      setRole('user');
      setConfirmPassword('');
    }
  }, [mode]);

  if (!mode) return null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier: usernameOrEmail, password, role })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Login failed');
        return;
      }
      await signIn({ name: json.user.name, email: usernameOrEmail.includes('@') ? usernameOrEmail : undefined, role: json.user.role });
      onClose();
    } catch {
      setError('Login failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Mock sign up; in real impl you'd call backend & validate phone/email/password
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      // Call backend signup to create user & send verification email
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: signupEmail, password, username: signupUsername, phone })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Signup failed');
        return;
      }
      setFlash(`Email verification sent to ${json.email}`);
      // Do not auto sign-in until email verified (could optionally sign in if desired)
      setTimeout(()=>{ setFlash(null); onClose(); }, 5000);
  } catch {
      setError('Signup failed.');
    } finally {
      setBusy(false);
    }
  }

  function renderLogin() {
    if (forgotMode) {
      return (
        <form onSubmit={(e)=>{e.preventDefault(); setForgotMode(false);}} className="space-y-5">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold text-white">Reset Password</h2>
            <p className="text-xs text-slate-400">Enter your account email. (Demo mode – no email will be sent.)</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium tracking-wide text-slate-400">Email</label>
            <input type="email" value={usernameOrEmail} onChange={e=>setUsernameOrEmail(e.target.value)} required className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" placeholder="you@example.com" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={()=>setForgotMode(false)} className="flex-1 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 hover:border-white/30">Back</button>
            <button className="flex-1 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white shadow hover:from-blue-400 hover:to-blue-500">Send Link</button>
          </div>
        </form>
      );
    }
    return (
      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-semibold text-white">Log In</h2>
          <p className="text-xs text-slate-400">Sign in with your username or email and password.</p>
        </div>
        <div className="space-y-4">
          <div className="flex justify-center rounded-full bg-white/5 p-1 text-xs font-medium text-slate-300 ring-1 ring-white/10">
            {(['user','admin'] as const).map(r => (
              <button key={r} type="button" onClick={()=>setRole(r)} className={`flex-1 rounded-full px-3 py-1 transition ${role===r? 'bg-blue-600 text-white shadow':'text-slate-400 hover:text-white'}`}>{r==='user'?'User':'Admin'}</button>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium tracking-wide text-slate-400">Username or Email</label>
            <input value={usernameOrEmail} onChange={e=>setUsernameOrEmail(e.target.value)} required className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" placeholder="yourname or you@example.com" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium tracking-wide text-slate-400">Password</label>
              <button type="button" onClick={()=>setForgotMode(true)} className="text-[11px] text-blue-400 hover:text-blue-300">Forgot?</button>
            </div>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" placeholder="••••••••" />
          </div>
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button disabled={busy || status==='loading'} className="w-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 py-2 text-sm font-semibold text-white shadow transition hover:from-blue-400 hover:to-blue-500 disabled:opacity-60">{busy? 'Please wait…' : 'Log In'}</button>
      </form>
    );
  }

  function renderSignup() {
    return (
      <form onSubmit={handleSignup} className="space-y-5">
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-semibold text-white">Create Account</h2>
          <p className="text-xs text-slate-400">Create your account to access resources (email verification required).</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium tracking-wide text-slate-400">Username</label>
            <input value={signupUsername} onChange={e=>setSignupUsername(e.target.value)} required className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" placeholder="wellnessfan" />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium tracking-wide text-slate-400">Email</label>
            <input type="email" value={signupEmail} onChange={e=>setSignupEmail(e.target.value)} required className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" placeholder="you@example.com" />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium tracking-wide text-slate-400">Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" placeholder="Create a strong password" />
          </div>
            <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium tracking-wide text-slate-400">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" placeholder="Repeat password" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium tracking-wide text-slate-400">Phone Number</label>
            <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} pattern="[+0-9\-() ]{6,}" className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" placeholder="+1 555 012 3456" />
          </div>
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {flash && <p className="text-xs text-emerald-400">{flash}</p>}
        <button disabled={busy || status==='loading'} className="w-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 py-2 text-sm font-semibold text-white shadow transition hover:from-blue-400 hover:to-blue-500 disabled:opacity-60">{busy? 'Please wait…' : 'Sign Up'}</button>
      </form>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:border-white/25 hover:text-white">×</button>
        {!session && (
          mode === 'login' ? renderLogin() : renderSignup()
        )}
        {session && (
          <div className="space-y-5 text-center">
            <h2 className="text-xl font-semibold text-white">You are signed in</h2>
            <p className="text-sm text-slate-300">{session.user.name}</p>
            <div className="flex gap-3">
              <button onClick={()=>{signOut();}} className="flex-1 rounded-full border border-white/15 bg-white/5 py-2 text-sm font-medium text-slate-200 hover:border-white/30">Sign Out</button>
              <button onClick={onClose} className="flex-1 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 py-2 text-sm font-semibold text-white shadow hover:from-blue-400 hover:to-blue-500">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
