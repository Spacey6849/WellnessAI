// Unified credential session hook (no next-auth dependency) providing { session, status, signIn, signOut }.
import { useCallback, useEffect, useState } from 'react';

export interface SessionUser { id: string; name: string; email?: string | null; avatarUrl?: string | null; role?: 'user' | 'admin' }
export interface Session { user: SessionUser; expires?: string; accessToken?: string }
interface UseSessionResult { session: Session | null; status: 'loading' | 'authenticated' | 'unauthenticated'; signIn: (user?: { name?: string; email?: string; role?: 'user'|'admin' }) => Promise<void> | void; signOut: () => Promise<void> | void }

export function useSession(): UseSessionResult {
  const [sessionState, setSessionState] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading'|'authenticated'|'unauthenticated'>('loading');

  // Supabase fallback (for email/password modal auth) only if no NextAuth session
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const r = await fetch('/api/auth/session', { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          if (j?.session?.user) {
            if(!active) return;
            setSessionState({ user: j.session.user, expires: undefined });
            setStatus('authenticated');
            return;
          }
        }
      } catch {/* ignore */}
      if(active){ setSessionState(null); setStatus('unauthenticated'); }
    }
    load();
    const handler = () => load();
    window.addEventListener('cred-session-updated', handler);
    return () => { active = false; window.removeEventListener('cred-session-updated', handler); };
  }, []);

  // Credential/local (non-Google) sign-in used by auth overlay. Accept minimal user info.
  const credentialSignIn = useCallback(async (user?: { name?: string; email?: string; role?: 'user'|'admin' }) => {
    if (!user) return;
    setSessionState({
      user: {
        id: user.email || user.name || 'user',
        name: user.name || (user.email ? user.email.split('@')[0] : 'User'),
        email: user.email,
        avatarUrl: null,
        role: user.role || 'user'
      },
      expires: undefined
    });
    setStatus('authenticated');
  }, []);

  const unifiedSignOut = useCallback(async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    setSessionState(null); setStatus('unauthenticated');
    window.dispatchEvent(new Event('cred-session-updated'));
  }, []);
  return { session: sessionState, status, signIn: credentialSignIn, signOut: unifiedSignOut };
}
