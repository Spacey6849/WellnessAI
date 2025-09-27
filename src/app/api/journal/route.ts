import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Minimal admin client (service role) - relies on env vars
function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// NOTE: We are in mock auth mode; expecting a header x-user-id until real auth integrated.
function getUserId(req: NextRequest): string | null {
  return req.headers.get('x-user-id');
}

export async function GET(req: NextRequest) {
  const uid = getUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = getAdmin();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const { data, error } = await supabase
      .from('user_journal')
      .select('id, entry, mood_snapshot, created_at, topic')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data });
}

export async function POST(req: NextRequest) {
  const uid = getUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = getAdmin();
    const body = await req.json().catch(() => null) as { entry?: string; mood_snapshot?: number; topic?: string };
  if (!body || !body.entry) return NextResponse.json({ error: 'entry required' }, { status: 400 });
    const insertPayload: Record<string, unknown> = { user_id: uid, entry: body.entry, mood_snapshot: body.mood_snapshot ?? null };
    if (body.topic && typeof body.topic === 'string' && body.topic.trim().length <= 120) {
      insertPayload.topic = body.topic.trim();
    }
    const { data, error } = await supabase
      .from('user_journal')
      .insert(insertPayload)
    .select('id, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at });
}
