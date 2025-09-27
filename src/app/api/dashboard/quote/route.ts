import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role client (server only)
function getAdmin(){
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{ autoRefreshToken:false, persistSession:false }});
}

// Simple curated fallback quotes (expand later or swap with AI model generation)
const FALLBACK_QUOTES = [
  { quote: 'Small consistent steps compound into meaningful change.', author: 'WellnessAI' },
  { quote: 'Your feelings are valid; how you respond is powerful.', author: 'WellnessAI' },
  { quote: 'Rest is productive when it restores your clarity.', author: 'WellnessAI' },
  { quote: 'Breath is the shortest distance between stress and calm.', author: 'WellnessAI' },
  { quote: 'You are allowed to be a work in progress and a masterpiece.', author: 'WellnessAI' }
];

function pickFallback(){ return FALLBACK_QUOTES[Math.floor(Math.random()*FALLBACK_QUOTES.length)]; }

export async function GET(req: NextRequest){
  const supabase = getAdmin();
  const url = new URL(req.url);
  const force = url.searchParams.get('refresh') === '1';
  const today = new Date().toISOString().slice(0,10); // UTC date implicitly

  // 1. Try existing (unless forced refresh)
  if(!force){
    const { data, error } = await supabase.from('daily_quotes').select('*').eq('quote_date', today).maybeSingle();
    if(error){
      // Non-fatal; fall back to generating
      console.warn('daily_quotes select error', error.message);
    } else if(data){
      return NextResponse.json({ date: data.quote_date, quote: data.quote, author: data.author || 'Unknown', source: data.source||null, cached:true });
    }
  }

  // 2. Generate or pick fallback (placeholder until AI integration)
  const generated = pickFallback();

  // 3. Upsert via helper function (ensures race-safe insert) – service role only
  const { data: ensured, error: ensureErr } = await supabase.rpc('ensure_daily_quote', { p_quote: generated.quote, p_author: generated.author });
  if(ensureErr){
    // Retry direct upsert as fallback
    console.warn('ensure_daily_quote RPC failed', ensureErr.message);
    const { data: upserted, error: upErr } = await supabase.from('daily_quotes').upsert({ quote_date: today, quote: generated.quote, author: generated.author }).select('*').single();
    if(upErr){
      return NextResponse.json({ error: 'Failed to persist quote', detail: upErr.message, quote: generated.quote }, { status:500 });
    }
    return NextResponse.json({ date: upserted.quote_date, quote: upserted.quote, author: upserted.author || 'Unknown', source: upserted.source||null, cached:false, regenerated:force });
  }

  const row = Array.isArray(ensured) ? ensured[0] : ensured; // RPC returns setof
  return NextResponse.json({ date: row.quote_date, quote: row.quote, author: row.author || 'Unknown', source: row.source||null, cached:false, regenerated:force });
}
