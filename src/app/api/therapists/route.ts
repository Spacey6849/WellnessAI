import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Public (read-only) list of active therapists from Supabase.
// This is separate from the admin endpoint which manages creation.
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('therapists')
      .select('id,name,specialty,bio,active')
      .eq('active', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ therapists: data ?? [] });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
