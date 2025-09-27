// Simple wrapper to include the user id header until full Supabase RLS integration.
// Detects Supabase session (supabase.auth) OR fallback mock session localStorage.
import { createSupabaseBrowserClient } from './supabaseClient';

const LS_KEY = 'wellnessai_mock_session_v1';

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  let uid: string | null = null;
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    uid = data.session?.user?.id || null;
  } catch {}
  if (!uid && typeof window !== 'undefined') {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) { const parsed = JSON.parse(raw); uid = parsed.user?.id; } } catch {}
  }
  const headers = new Headers(init.headers || {});
  if (uid && !headers.has('x-user-id')) headers.set('x-user-id', uid);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  return fetch(input, { ...init, headers });
}
