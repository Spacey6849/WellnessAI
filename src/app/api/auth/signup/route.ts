/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
// nodemailer lacks bundled types in this project; local declaration added in types/nodemailer.d.ts
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Expect environment vars for transporter. We allow either the EMAIL_* or SMTP_* naming scheme.
// Preferred: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, APP_BASE_URL
// Backward compat: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM

function firstExisting(names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  throw new Error(`Missing env var (tried): ${names.join(', ')}`);
}

export async function POST(req: NextRequest) {
  try {
  const { email, password, username, phone } = await req.json(); // phone optional, stored in user_profiles.phone
    if (!email || !password) return new Response(JSON.stringify({ error: 'email & password required'}), { status: 400 });
    const supabase = getSupabaseAdmin();

    // Create auth user via admin API (service role). If user exists this will error.
    const { data: signUp, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false
    });
    if (signUpError) throw signUpError;
    const userId = signUp.user.id;

    // Set username if provided
  type ProfileUpdate = { username?: string|null; display_name?: string|null; email_verification_token?: string|null; email_verification_token_expires_at?: string|null };
  const baseProfile: ProfileUpdate & { email?: string|null } = {};
  baseProfile.email = email; // store duplicate for quick lookups
    if (username) {
      baseProfile.username = username;
      baseProfile.display_name = username;
    }
    if (phone) {
      (baseProfile as any).phone = phone; // column exists in schema
    }
    // Hash password and update profile with hashed_password and role
    const hashed = await bcrypt.hash(password, 10);
    (baseProfile as any).hashed_password = hashed;
    (baseProfile as any).role = 'user';
  await (supabase as any).from('user_profiles').update(baseProfile).eq('user_id', userId);

    // Generate verification token & store
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
    const verificationUpdate: ProfileUpdate = {
      email_verification_token: token,
      email_verification_token_expires_at: expires.toISOString()
    };
  await (supabase as any).from('user_profiles').update(verificationUpdate).eq('user_id', userId);

    const baseUrl = process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`;

    // Send email
    const host = firstExisting(['SMTP_HOST','EMAIL_HOST']);
    const portStr = firstExisting(['SMTP_PORT','EMAIL_PORT']);
    const port = parseInt(portStr, 10) || 587;
    const user = firstExisting(['SMTP_USER','EMAIL_USER']);
    const pass = firstExisting(['SMTP_PASS','EMAIL_PASS']);
    const from = process.env.MAIL_FROM || process.env.EMAIL_FROM || user;

    const transporter = nodemailer.createTransport({
      host,
      port,
      // Use secure for implicit TLS ports (465). Otherwise let nodemailer upgrade with STARTTLS.
      secure: port === 465,
      auth: { user, pass }
    });
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Verify your email',
      text: `Click to verify: ${verifyUrl}`,
      html: `<p>Welcome! Please verify your email:</p><p><a href="${verifyUrl}">Verify Email</a></p>`
    });

    return new Response(JSON.stringify({ success: true, email }), { status: 201 });
  } catch (e) {
    const err = e as Error;
    console.error('Signup error:', err);
    return new Response(JSON.stringify({ error: err.message || 'error'}), { status: 500 });
  }
}