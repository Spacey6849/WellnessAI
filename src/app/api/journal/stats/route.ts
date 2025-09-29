import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getUserId(req: NextRequest): string | null {
  return req.headers.get('x-user-id');
}

export async function GET(req: NextRequest) {
  const uid = getUserId(req);
  if(!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = getAdmin();
  try {
    const [entriesMeta, topicQuery, moodQuery] = await Promise.all([
      supabase.from('user_journal').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('user_journal').select('topic').eq('user_id', uid).not('topic','is',null),
      supabase.from('user_journal').select('mood_snapshot').eq('user_id', uid).not('mood_snapshot','is',null)
    ]);
    if (entriesMeta.error) throw entriesMeta.error;
    if (topicQuery.error) throw topicQuery.error;
    if (moodQuery.error) throw moodQuery.error;
    const topics = new Set<string>();
    (topicQuery.data||[]).forEach(r => { if (r.topic) topics.add(r.topic); });
    const moods = (moodQuery.data||[]).map(r => r.mood_snapshot).filter((m: number | null) => typeof m === 'number');
    const avgMood = moods.length ? (moods.reduce((a:number,b:number)=>a+b,0)/moods.length) : null;
    return NextResponse.json({ entries: entriesMeta.count || 0, topics: topics.size, avgMood });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
