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

    // 1. Insert mood entry (do not embed sleep hours here to avoid coupling) if mood provided.
    if(typeof body.mood === 'number'){
      const { error: moodErr } = await supabase.from('mood_entries').insert({ user_id: uid, mood: body.mood, note: body.note || null });
      if(moodErr && !/duplicate key/i.test(moodErr.message)) {
        // Return only if not a duplicate; duplicates are treated as idempotent no-op.
        return NextResponse.json({ error: moodErr.message }, { status:500 });
      }
    }

    // 2. Upsert sleep entry (idempotent) if provided. Use explicit onConflict merge pattern.
    if(typeof body.sleep_hours === 'number'){
      const today = new Date().toISOString().slice(0,10);
      const { error: sleepErr } = await supabase.from('sleep_entries')
        .upsert({ user_id: uid, date: today, hours: body.sleep_hours }, { onConflict: 'user_id,date' });
      if(sleepErr && !/duplicate key/i.test(sleepErr.message)) {
        return NextResponse.json({ error: sleepErr.message }, { status:500 });
      }
    }

    return NextResponse.json({ ok:true });
  } catch (err){
    return NextResponse.json({ error: (err as Error).message }, { status:500 });
  }
}
