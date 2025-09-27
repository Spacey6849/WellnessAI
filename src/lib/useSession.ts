// Wrapper around next-auth to preserve existing component expectations.
// Provides { session, status, signIn, signOut } similar to legacy mock.
import { signOut as nextSignOut, useSession as useNextSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from './supabaseClient';
import type { Session as NextAuthSession } from 'next-auth';

export interface SessionUser { id: string; name: string; email?: string | null; avatarUrl?: string | null; role?: 'user' | 'admin' }
export interface Session { user: SessionUser; expires?: string; accessToken?: string }
interface UseSessionResult { session: Session | null; status: 'loading' | 'authenticated' | 'unauthenticated'; signIn: (user?: { name?: string; email?: string; role?: 'user'|'admin' }) => Promise<void> | void; signOut: () => Promise<void> | void }

export function useSession(): UseSessionResult {
  const { data: nextData, status: nextStatus } = useNextSession();
  const pathname = usePathname();
  const allowGoogle = typeof window !== 'undefined' && pathname?.startsWith('/booking');
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<'loading'|'authenticated'|'unauthenticated'>('loading');

  // Supabase fallback (for email/password modal auth) only if no NextAuth session
  useEffect(()=>{
    let active = true;
    (async () => {
      try {
        if (nextData) { // if NextAuth active, skip supabase fetch
          setSupabaseStatus('unauthenticated');
          return;
        }
        // First: attempt cookie-backed credential session
        try {
          const r = await fetch('/api/auth/session', { cache: 'no-store' });
          if (r.ok) {
            const j = await r.json();
            if (j?.session?.user) {
              if(!active) return;
              setSupabaseSession({ user: j.session.user, expires: undefined });
              setSupabaseStatus('authenticated');
              return; // stop; cookie session restored
            }
          }
        } catch { /* ignore */ }
        // Fallback: legacy Supabase browser session if any (kept for transition)
        try {
          const supabase = createSupabaseBrowserClient();
          const { data } = await supabase.auth.getSession();
          if(!active) return;
          if (data.session?.user) {
            const u = data.session.user;
            setSupabaseSession({
              user: { id: u.id, name: u.email?.split('@')[0] || 'User', email: u.email || undefined, avatarUrl: null, role: 'user' },
              expires: undefined
            });
            setSupabaseStatus('authenticated');
          } else {
            setSupabaseSession(null); setSupabaseStatus('unauthenticated');
          }
        } catch {
          if(active){ setSupabaseSession(null); setSupabaseStatus('unauthenticated'); }
        }
      } catch {
        if(active){ setSupabaseSession(null); setSupabaseStatus('unauthenticated'); }
      }
    })();
    return ()=>{ active=false; };
  },[nextData]);

  interface NextAuthSessionExtended extends NextAuthSession { accessToken?: string; user?: (NextAuthSession['user'] & { id?: string; role?: string }) }
  const nextMapped = useMemo<Session | null>(() => {
    if (!nextData) return null;
    const s = nextData as NextAuthSessionExtended;
    const u = s.user || {};
    const id = typeof (u as { id?: unknown }).id === 'string' ? (u as { id?: string }).id : undefined;
    const roleRaw = typeof (u as { role?: unknown }).role === 'string' ? (u as { role?: string }).role : undefined;
    const role: 'user' | 'admin' | undefined = roleRaw === 'admin' ? 'admin' : roleRaw ? 'user' : undefined;
    return {
      user: {
        id: id || u.email || 'user',
        name: u.name || (u.email ? u.email.split('@')[0] : 'User'),
        email: u.email,
        avatarUrl: u.image || null,
        role: (role || 'user')
      },
      expires: s.expires,
      accessToken: s.accessToken
    };
  }, [nextData]);

  // Only expose Google (NextAuth) session outside components when on booking page.
  const effectiveSession = (allowGoogle ? nextMapped : null) || supabaseSession;
  const effectiveStatus = allowGoogle && nextStatus === 'authenticated'
    ? 'authenticated'
    : (supabaseStatus);

  // Credential/local (non-Google) sign-in used by auth overlay. Accept minimal user info.
  const credentialSignIn = useCallback(async (user?: { name?: string; email?: string; role?: 'user'|'admin' }) => {
    // Do NOT trigger Google OAuth; just set a local (supabase-style) session if no Google session present.
    if (nextMapped) return; // If Google session exists, ignore credential sign-in to avoid masking
    if (!user) return;
    setSupabaseSession({
      user: {
        id: user.email || user.name || 'user',
        name: user.name || (user.email ? user.email.split('@')[0] : 'User'),
        email: user.email,
        avatarUrl: null,
        role: user.role || 'user'
      },
      expires: undefined
    });
    setSupabaseStatus('authenticated');
  }, [nextMapped]);

  const unifiedSignOut = useCallback(async () => {
    if (allowGoogle && nextMapped) {
      await nextSignOut();
      return;
    }
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    setSupabaseSession(null); setSupabaseStatus('unauthenticated');
  }, [nextMapped, allowGoogle]);

  return { session: effectiveSession, status: effectiveStatus, signIn: credentialSignIn, signOut: unifiedSignOut };
}
