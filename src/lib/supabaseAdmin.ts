import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Server-side privileged client (NEVER expose service key to the browser)
// Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

let adminSingleton: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdmin() {
  if (adminSingleton) return adminSingleton;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  adminSingleton = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'X-Client-Info': 'wellness-ai-server' } }
  });
  return adminSingleton;
}
