/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import bcrypt from 'bcryptjs';

// Temporary login route allowing username OR email. For now we do NOT verify the password
// against Supabase auth (would require signInWithPassword client-side). Instead we:
// 1. Accept identifier (usernameOrEmail) and password
// 2. Look up user_profiles by username OR the auth email via a RPC-style dual query.
// 3. Return minimal session payload the client mock useSession can store.
// WARNING: This endpoint is NOT secure and only for transition from mock auth.

// Simple HMAC signing for credential cookie (NOT a replacement for real auth)
function sign(value: string) {
  const secret = process.env.CREDENTIAL_SESSION_SECRET || 'dev-insecure-secret';
  const h = crypto.createHmac('sha256', secret).update(value).digest('base64url');
  return `${value}.${h}`;
}

export async function POST(req: NextRequest) {
  try {
    const { identifier, password, role } = await req.json();
    if (!identifier || !password) {
      return new Response(JSON.stringify({ error: 'Invalid credentials'}), { status: 400 });
    }
    // Explicit mode selection (defaults to user). We do *not* elevate a normal user profile to admin automatically.
    const desiredRole: 'admin' | 'user' = role === 'admin' ? 'admin' : 'user';
    const supabase = getSupabaseAdmin();
  let profile: any = null;
  interface AdminRow { id: string; username: string; email?: string | null; password_hash: string; created_at?: string }
  interface UserRow { user_id: string; username: string | null; display_name: string | null; role?: string | null; hashed_password?: string | null; email?: string | null }

    const looksLikeEmail = identifier.includes('@');

    if (desiredRole === 'admin') {
      // Admin mode: look only in admin_accounts. Avoid timing difference leaks by performing both lookups.
      const fetchByUsername = !looksLikeEmail ? supabase
        .from('admin_accounts')
        .select('id,username,email,password_hash')
        .ilike('username', identifier)
        .maybeSingle() : Promise.resolve({ data: null, error: null });
      const fetchByEmail = supabase
        .from('admin_accounts')
        .select('id,username,email,password_hash')
        .ilike('email', identifier)
        .maybeSingle();
      const [userAttempt, emailAttempt] = await Promise.all([fetchByUsername, fetchByEmail]);
      if (userAttempt.error && userAttempt.error.code !== 'PGRST116') throw userAttempt.error;
      if (emailAttempt.error && emailAttempt.error.code !== 'PGRST116') throw emailAttempt.error;
      const adminRow = (userAttempt.data as AdminRow | null) || (emailAttempt.data as AdminRow | null);
      if (!adminRow) {
        return new Response(JSON.stringify({ error: 'Invalid credentials'}), { status: 401 });
      }
      const valid = await bcrypt.compare(password, adminRow.password_hash);
      if (!valid) return new Response(JSON.stringify({ error: 'Invalid credentials'}), { status: 401 });
      profile = { user_id: adminRow.id, username: adminRow.username, display_name: adminRow.username, role: 'admin' };
    } else {
      let userRow: UserRow | null = null;
      if (!looksLikeEmail) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('user_id,username,display_name,role,hashed_password,email')
          .ilike('username', identifier)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        userRow = data as UserRow | null;
      }
      if (!userRow && looksLikeEmail) {
        // Now user_profiles has an email column, prefer direct match
        const { data, error } = await supabase
          .from('user_profiles')
          .select('user_id,username,display_name,role,hashed_password,email')
          .ilike('email', identifier)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        userRow = userRow || (data as UserRow | null);
      }
      if (!userRow) {
        return new Response(JSON.stringify({ error: 'Invalid credentials'}), { status: 401 });
      }
      if (userRow.hashed_password) {
        const valid = await bcrypt.compare(password, userRow.hashed_password);
        if (!valid) return new Response(JSON.stringify({ error: 'Invalid credentials'}), { status: 401 });
        profile = { user_id: userRow.user_id, username: userRow.username, display_name: userRow.display_name, role: userRow.role || 'user' };
      } else if (looksLikeEmail) {
        // Legacy fallback via Supabase auth
        try {
          const { data: authUser, error: authErr } = await (supabase.auth as any).signInWithPassword({ email: identifier, password });
          if (authErr || !authUser?.user) return new Response(JSON.stringify({ error: 'Invalid credentials'}), { status: 401 });
          profile = { user_id: authUser.user.id, username: userRow.username, display_name: userRow.display_name, role: userRow.role || 'user' };
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid credentials'}), { status: 401 });
        }
      } else {
        return new Response(JSON.stringify({ error: 'Invalid credentials'}), { status: 401 });
      }
    }
    if (!profile) return new Response(JSON.stringify({ error: 'Invalid credentials'}), { status: 401 });

  const userPayload = { id: profile.user_id, name: profile.display_name || profile.username || 'User', role: (profile.role || desiredRole), username: profile.username };
  // Encode + sign minimal session (no PII beyond what navbar needs)
  const raw = JSON.stringify({ u: userPayload, iat: Date.now() });
  const b64 = Buffer.from(raw).toString('base64url');
  const signed = sign(b64);

  // Set HttpOnly cookie (session length ~7 days)
  const cookieStore = await cookies();
  cookieStore.set({
    name: 'cred_session',
    value: signed,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });

  return new Response(JSON.stringify({ user: userPayload }), { status: 200 });
  } catch {
    // Avoid exposing internal details; log server-side if needed.
    return new Response(JSON.stringify({ error: 'Unable to process login'}), { status: 500 });
  }
}
