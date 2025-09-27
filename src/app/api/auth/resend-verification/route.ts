import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateSecureToken, sendEmail } from '@/lib/email';

// POST { email }
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json().catch(()=>({}));
    if (!email || typeof email !== 'string') return NextResponse.json({ error: 'email required' }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data: usersPage, error: userErr } = await supabase.auth.admin.listUsers({ page:1, perPage:200 });
    if (userErr) throw userErr;
    const found = usersPage.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    // Always return ok to prevent enumeration
    if (!found) return NextResponse.json({ ok: true });
    // Check profile verification
  interface VerificationProfile { user_id: string; email_verified_at: string | null }
  const { data: profiles, error: profErr } = await supabase.from('user_profiles').select('user_id, email_verified_at').eq('user_id', found.id).limit(1);
    if (profErr) throw profErr;
    if (!profiles || profiles.length === 0) return NextResponse.json({ ok: true });
  const profile = profiles[0] as VerificationProfile;
    if (profile.email_verified_at) return NextResponse.json({ ok: true });
    const token = generateSecureToken(24);
    const expires = new Date(Date.now() + 1000*60*60); // 1 hour
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (supabase.from('user_profiles') as any)
      .update({ email_verification_token: token, email_verification_token_expires_at: expires.toISOString() })
      .eq('user_id', found.id);
    if (upErr) throw upErr;
    const verifyUrl = (process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/verify?token=' + token;
    await sendEmail({
      to: email,
      subject: 'Verify your email',
      text: `Click to verify: ${verifyUrl}`,
      html: `<p>Welcome! Verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}