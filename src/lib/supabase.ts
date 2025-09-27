import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lightweight singleton helpers for server/client usage.
// In this project we rely mostly on route handlers (server) and a few client components (auth flows).
// This helper gracefully no-ops if env vars are missing to avoid hard crashes during design time.

let browserClient: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  browserClient = createClient(url, anon, { auth: { persistSession: true } });
  return browserClient;
}

// Server client: prefer using service role only inside secure server contexts (API routes / server actions).
// We expose an explicit getter; do not import this into client bundles.
export function getServerClient(): SupabaseClient | null {
  if (typeof window !== 'undefined') return null; // guard
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; // still public base URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Convenience fetchers (can be expanded later) ----------------------------

export async function fetchRecentMoodEntries(userId: string, limit = 14) {
  const client = getServerClient() ?? getBrowserClient();
  if (!client) return [] as { created_at: string; mood: number; sleep_hours: number | null }[];
  const { data, error } = await client
    .from('mood_entries')
    .select('created_at,mood,sleep_hours')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.reverse(); // chronological ascending
}
