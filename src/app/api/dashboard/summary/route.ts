import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{ autoRefreshToken:false, persistSession:false }});} 
function getUserId(req: NextRequest){return req.headers.get('x-user-id');}

export async function GET(req: NextRequest){
  const uid = getUserId(req); if(!uid) return NextResponse.json({error:'unauthorized'},{status:401});
  const supabase = getAdmin();

  // Parallel queries
  const [aiSessionsCount, communityTouches, recentMood, recentSleep, profile] = await Promise.all([
    supabase.from('chat_sessions').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('author_id', uid),
    supabase.from('mood_entries').select('created_at, mood').eq('user_id', uid).order('created_at',{ascending:false}).limit(14),
    supabase.from('sleep_entries').select('date, hours').eq('user_id', uid).order('date',{ascending:false}).limit(14),
    supabase.from('user_profiles').select('daily_streak,last_activity_date').eq('user_id', uid).single()
  ]);

  // Derive scores
  const moodList = (recentMood.data||[]).slice().reverse();
  const sleepList = (recentSleep.data||[]).slice().reverse();
  const trendDays: string[] = [];
  const moodSeries: number[] = [];
  const sleepSeries: number[] = [];
  const healthSeries: number[] = [];
  const byDate: Record<string,{ mood?: number; sleep?: number }> = {};
  for(const m of moodList){ const d = m.created_at.slice(0,10); byDate[d] = byDate[d]||{}; byDate[d].mood = m.mood; }
  for(const s of sleepList){ const d = s.date; byDate[d] = byDate[d]||{}; byDate[d].sleep = s.hours; }
  const today = new Date();
  for(let i=6;i>=0;i--){
    const d = new Date(today.getTime()-i*86400000).toISOString().slice(0,10);
    trendDays.push(d.slice(5));
    const rec = byDate[d]||{};
    moodSeries.push(rec.mood ?? 0);
    sleepSeries.push(rec.sleep ?? 0);
    healthSeries.push(Math.round(((rec.mood??0)/10*0.6 + (rec.sleep??0)/8*0.4)*10)/10); // simple composite
  }

  const avgMood = moodSeries.filter(n=>n>0).reduce((a,b)=>a+b,0) / (moodSeries.filter(n=>n>0).length||1);
  const avgSleep = sleepSeries.filter(n=>n>0).reduce((a,b)=>a+b,0) / (sleepSeries.filter(n=>n>0).length||1);

  return NextResponse.json({
    moodScore: Number(avgMood.toFixed(1)) || 0,
    sleepQuality: Math.round((avgSleep/8)*100) || 0,
    aiSessions: aiSessionsCount.count || 0,
    communityTouches: communityTouches.count || 0,
    trends: { days: trendDays, mood: moodSeries, sleep: sleepSeries, health: healthSeries },
    streak: profile.data?.daily_streak || 0,
    lastActivityDate: profile.data?.last_activity_date || null
  });
}
