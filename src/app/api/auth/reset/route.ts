import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// POST { token, password }
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json().catch(()=>({}));
    if (!token || typeof token !== 'string') return NextResponse.json({ error: 'token required' }, { status: 400 });
    if (!password || typeof password !== 'string' || password.length < 8) return NextResponse.json({ error: 'password too short' }, { status: 400 });
    const supabase = getSupabaseAdmin();
    // Find profile with matching token & not expired
    interface ProfileResetRow { user_id: string; reset_password_token_expires_at: string | null }
    const { data: profiles, error: profErr } = await supabase
      .from('user_profiles')
      .select('user_id, reset_password_token_expires_at')
      .eq('reset_password_token', token)
      .limit(1);
    if (profErr) throw profErr;
    if (!profiles || profiles.length === 0) return NextResponse.json({ error: 'invalid token' }, { status: 400 });
  const profile = profiles[0] as ProfileResetRow;
    if (!profile.reset_password_token_expires_at || new Date(profile.reset_password_token_expires_at) < new Date()) {
      return NextResponse.json({ error: 'token expired' }, { status: 400 });
    }
    // Update auth user password
    const { error: passErr } = await supabase.auth.admin.updateUserById(profile.user_id, { password });
    if (passErr) throw passErr;
    // Clear token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: clrErr } = await (supabase.from('user_profiles') as any)
      .update({ reset_password_token: null, reset_password_token_expires_at: null })
      .eq('user_id', profile.user_id);
    if (clrErr) throw clrErr;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}