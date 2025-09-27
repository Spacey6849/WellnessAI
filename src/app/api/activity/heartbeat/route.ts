import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdmin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{autoRefreshToken:false,persistSession:false}});
const getUserId = (req: NextRequest) => req.headers.get('x-user-id');

export async function POST(req: NextRequest){
  const uid = getUserId(req); if(!uid) return NextResponse.json({error:'unauthorized'},{status:401});
  const { sleep_hours, mood } = await req.json().catch(()=>({})) as { sleep_hours?: number; mood?: number };
  const supabase = getAdmin();
  // invoke function inside a transaction-like sequence
  const { error: fnError } = await supabase.rpc('activity_heartbeat', { p_sleep_hours: sleep_hours ?? null, p_mood: mood ?? null });
  if (fnError) return NextResponse.json({ error: fnError.message }, { status: 500 });
  const { data: profile } = await supabase.from('user_profiles').select('daily_streak,last_activity_date').eq('user_id', uid).single();
  return NextResponse.json({ ok:true, streak: profile?.daily_streak ?? 0, last_activity_date: profile?.last_activity_date });
}
