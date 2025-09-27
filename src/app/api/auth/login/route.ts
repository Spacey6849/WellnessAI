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
      return new Response(JSON.stringify({ error: 'identifier and password required'}), { status: 400 });
    }
    const desiredRole = role === 'admin' ? 'admin' : 'user';
    const supabase = getSupabaseAdmin();
  let profile: any = null;
  interface AdminRow { id: string; username: string; email?: string | null; password_hash: string; created_at?: string }
  interface UserRow { user_id: string; username: string | null; display_name: string | null; role?: string | null; hashed_password?: string | null }

    const looksLikeEmail = identifier.includes('@');

    if (desiredRole === 'admin') {
      // Try username OR email (two queries, prefer username hit first for speed)
      let adminRow: AdminRow | null = null;
      if (!looksLikeEmail) {
        const { data, error } = await supabase
          .from('admin_accounts')
          .select('id,username,email,password_hash')
          .ilike('username', identifier)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error; // ignore no rows
        adminRow = data as AdminRow | null;
      }
      if (!adminRow) {
        const { data, error } = await supabase
          .from('admin_accounts')
            .select('id,username,email,password_hash')
            .ilike('email', identifier)
            .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        adminRow = adminRow || (data as AdminRow | null);
      }
      if (adminRow) {
        const valid = await bcrypt.compare(password, adminRow.password_hash);
        if (!valid) return new Response(JSON.stringify({ error: 'Invalid credentials'}), { status: 401 });
        profile = { user_id: adminRow.id, username: adminRow.username, display_name: adminRow.username, role: 'admin' };
      }
    } else {
      let userRow: UserRow | null = null;
      if (!looksLikeEmail) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('user_id,username,display_name,role,hashed_password')
          .ilike('username', identifier)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        userRow = data as UserRow | null;
      }
      if (!userRow && looksLikeEmail) {
        // Heuristic: try to match email's local-part to username (since user_profiles does not store email directly)
        const localPart = identifier.split('@')[0];
        const { data, error } = await supabase
          .from('user_profiles')
          .select('user_id,username,display_name,role,hashed_password')
          .ilike('username', localPart)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        userRow = userRow || (data as UserRow | null);
      }
      if (userRow) {
        if (!userRow.hashed_password) {
          return new Response(JSON.stringify({ error: 'Account not configured for password login'}), { status: 401 });
        }
        const valid = await bcrypt.compare(password, userRow.hashed_password);
        if (!valid) return new Response(JSON.stringify({ error: 'Invalid credentials'}), { status: 401 });
        const uid = userRow.user_id;
        profile = { user_id: uid, username: userRow.username, display_name: userRow.display_name, role: userRow.role || 'user' };
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
  } catch (e) {
    const err = e as Error;
    return new Response(JSON.stringify({ error: err.message || 'error'}), { status: 500 });
  }
}
