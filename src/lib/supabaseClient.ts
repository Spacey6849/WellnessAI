import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Lightweight browser client factory. In Next.js App Router, prefer server actions or route handlers
// with the service role for privileged operations; this anon client is only for public, RLS-safe reads.

let browserSingleton: ReturnType<typeof createClient<Database>> | null = null;
export const createSupabaseBrowserClient = () => {
  if (browserSingleton) return browserSingleton;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anon) {
    throw new Error('Supabase public env vars missing');
  }
  browserSingleton = createClient<Database>(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return browserSingleton;
};
