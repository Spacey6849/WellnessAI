import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Simple helper for service role access (server only)
function getAdmin(){
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth:{ autoRefreshToken:false, persistSession:false } });
}

// POST: log a combined health check (mood + sleep in one multi-step submission)
// Body: { mood: number (1-10), sleep_hours: number, note?: string }
export async function POST(req: Request){
  try {
    const uid = req.headers.get('x-user-id');
    if(!uid) return NextResponse.json({ error:'missing user id'}, { status:400 });
    const body = await req.json().catch(()=>({})) as { mood?: number; sleep_hours?: number; note?: string };
    const supabase = getAdmin();

    // Insert mood entry if provided
    if(typeof body.mood === 'number'){
      const { error: moodErr } = await supabase.from('mood_entries').insert({ user_id: uid, mood: body.mood, sleep_hours: typeof body.sleep_hours === 'number' ? body.sleep_hours : null, note: body.note || null });
      if(moodErr) return NextResponse.json({ error: moodErr.message }, { status:500 });
    }
    // Upsert sleep entry for today if provided
    if(typeof body.sleep_hours === 'number'){
      const today = new Date().toISOString().slice(0,10);
      const { error: sleepErr } = await supabase.from('sleep_entries').upsert({ user_id: uid, date: today, hours: body.sleep_hours });
      if(sleepErr) return NextResponse.json({ error: sleepErr.message }, { status:500 });
    }

    return NextResponse.json({ ok:true });
  } catch (err){
    return NextResponse.json({ error: (err as Error).message }, { status:500 });
  }
}
