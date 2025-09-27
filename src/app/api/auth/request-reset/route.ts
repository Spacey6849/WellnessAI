import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateSecureToken, sendEmail, resetLink } from '@/lib/email';

// POST { email }
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json().catch(()=>({}));
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    // Find user profile via auth.users
  const { data: usersPage, error: userErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (userErr) throw userErr;
  const match = usersPage.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    // Always respond 200 to avoid user enumeration
    if (!match) {
      return NextResponse.json({ ok: true });
    }
    const token = generateSecureToken(24);
    const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 min
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (supabase.from('user_profiles') as any)
      .update({ reset_password_token: token, reset_password_token_expires_at: expires.toISOString() })
      .eq('user_id', match.id);
    if (upErr) throw upErr;
    const baseUrl = process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const link = resetLink(baseUrl, token);
    await sendEmail({
      to: email,
      subject: 'Password Reset',
      text: `Reset your password: ${link}\nThis link expires in 30 minutes.`,
      html: `<p>Reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 30 minutes.</p>`
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}