import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getUserId(req: NextRequest) {
  return req.headers.get('x-user-id');
}

export async function GET(req: NextRequest) {
  const uid = getUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from('mood_entries')
    .select('id, mood, sleep_hours, energy, stress, note, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ moods: data });
}

export async function POST(req: NextRequest) {
  const uid = getUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null) as { mood?: number; sleep_hours?: number; energy?: number; stress?: number; note?: string };
  if (!body || typeof body.mood !== 'number') return NextResponse.json({ error: 'mood required' }, { status: 400 });
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from('mood_entries')
    .insert({ user_id: uid, mood: body.mood, sleep_hours: body.sleep_hours ?? null, energy: body.energy ?? null, stress: body.stress ?? null, note: body.note ?? null })
    .select('id, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at });
}
