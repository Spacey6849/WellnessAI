/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type ProfileTokenRow = { user_id: string; email_verification_token_expires_at: string | null };

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const appBase = process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  if (!token) {
    return Response.redirect(`${appBase}?verify=missing`, 302);
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('user_profiles')
      .select('user_id, email_verification_token_expires_at')
      .eq('email_verification_token', token)
      .maybeSingle<ProfileTokenRow>();
    if (error) throw error;
    if (!data) return Response.redirect(`${appBase}?verify=invalid`, 302);
    if (data.email_verification_token_expires_at && new Date(data.email_verification_token_expires_at) < new Date()) {
      return Response.redirect(`${appBase}?verify=expired`, 302);
    }
    await (supabase as any).from('user_profiles').update({
      email_verified_at: new Date().toISOString(),
      email_verification_token: null,
      email_verification_token_expires_at: null
    }).eq('user_id', data.user_id);
    return Response.redirect(`${appBase}?verify=success`, 302);
  } catch {
    return Response.redirect(`${appBase}?verify=error`, 302);
  }
}