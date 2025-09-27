import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } }); }
function getUserId(req: NextRequest) { return req.headers.get('x-user-id'); }

export async function GET(req: NextRequest) {
  const uid = getUserId(req); if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from('sleep_entries')
    .select('date, hours, quality')
    .eq('user_id', uid)
    .order('date', { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sleep: data });
}

export async function POST(req: NextRequest) {
  const uid = getUserId(req); if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(()=>null) as { date?: string; hours?: number; quality?: number };
  if (!body?.date || typeof body.hours !== 'number') return NextResponse.json({ error: 'date & hours required' }, { status: 400 });
  const supabase = getAdmin();
  // Upsert style: try update first
  const { error } = await supabase.from('sleep_entries').upsert({ user_id: uid, date: body.date, hours: body.hours, quality: body.quality ?? null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
