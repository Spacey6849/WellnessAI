import { NextRequest } from 'next/server';
import { getServerClient } from '@/lib/supabase';

function getUserId(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  const [, token] = auth.split(' ');
  return token || null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    const supabase = getServerClient();
    if (!supabase) return new Response(JSON.stringify({ error: 'supabase not configured' }), { status: 500 });

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    if (!sessionId) return new Response(JSON.stringify({ error: 'session_id required' }), { status: 400 });

    const { data, error } = await supabase
      .from('chat_messages')
      .select('id,role,content:prompt,ai_response,created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) throw error;

    // Normalize role/content to single field for UI consumption
    const messages = (data || []).map(m => ({
      id: m.id,
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.role === 'assistant' ? (m.ai_response || '') : (m.content || ''),
      created_at: m.created_at,
    }));

    return new Response(JSON.stringify({ messages }), { headers: { 'content-type': 'application/json' } });
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

  const body = (await req.json().catch(() => ({}))) as { session_id?: string; role?: string; content?: string };
  const { session_id, role, content } = body;
    if (!session_id) return new Response(JSON.stringify({ error: 'session_id required' }), { status: 400 });
    if (!role || !content) return new Response(JSON.stringify({ error: 'role and content required' }), { status: 400 });

    // Insert message. For assistant role, store in ai_response column; for user role store in prompt.
    const insertPayload = role === 'assistant'
      ? { session_id, user_id: userId, role: 'assistant', ai_response: content }
      : { session_id, user_id: userId, role: 'user', prompt: content };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(insertPayload)
      .select('id,role,prompt,ai_response,created_at')
      .single();

    if (error) throw error;

    const normalized = {
      id: data.id,
      role: data.role === 'assistant' ? 'assistant' : 'user',
      content: data.role === 'assistant' ? (data.ai_response || '') : (data.prompt || ''),
      created_at: data.created_at,
    };

    // Optional immediate update of session updated_at is handled by DB trigger (assumed). If not present, we could update here.

    return new Response(JSON.stringify({ message: normalized }), { status: 201, headers: { 'content-type': 'application/json' } });
  } catch (e: unknown) {
    const msg = (e as { message?: string }).message || 'server error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export const dynamic = 'force-dynamic';
