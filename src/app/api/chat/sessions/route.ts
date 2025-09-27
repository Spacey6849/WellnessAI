import { NextRequest } from 'next/server';
import { getServerClient } from '@/lib/supabase';

// Helper to extract user id from auth header (Bearer) in absence of middleware session.
function getUserId(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  const [, token] = auth.split(' ');
  // For now we treat token directly as user id (placeholder) unless proper JWT validation is added.
  return token || null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    const supabase = getServerClient();
    if (!supabase) return new Response(JSON.stringify({ error: 'supabase not configured' }), { status: 500 });
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id,title,created_at,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return new Response(JSON.stringify({ sessions: data }), { headers: { 'content-type': 'application/json' } });
  } catch (e: unknown) {
    const msg = (e as { message?: string }).message || 'server error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    const supabase = getServerClient();
    if (!supabase) return new Response(JSON.stringify({ error: 'supabase not configured' }), { status: 500 });

    const body = (await req.json().catch(() => ({}))) as { title?: string };
    const title = body.title?.trim() || 'New Conversation';

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ user_id: userId, title })
      .select('id,title,created_at,updated_at')
      .single();

    if (error) throw error;
    return new Response(JSON.stringify({ session: data }), { status: 201, headers: { 'content-type': 'application/json' } });
  } catch (e: unknown) {
    const msg = (e as { message?: string }).message || 'server error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export const dynamic = 'force-dynamic';
