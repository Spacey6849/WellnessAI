/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { Database } from '@/types/supabase';

type UserProfilePatch = Database['public']['Tables']['user_profiles']['Update'];

// Editable fields white-list
const EDITABLE_FIELDS = new Set(['display_name','avatar_url','username','phone']);

function extractUserId(req: NextRequest): string | null {
  // Current minimal session header pattern (x-user-id) used elsewhere; fallback none.
  const h = req.headers.get('x-user-id');
  if (h && /^[0-9a-fA-F-]{8,}$/.test(h)) return h;
  // Could inspect cookies/session endpoint in future.
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = extractUserId(req);
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ profile: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'unexpected' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = extractUserId(req);
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const body = await req.json().catch(()=>null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    const patch: UserProfilePatch = {};
    for (const [k,v] of Object.entries(body)) {
      if (!EDITABLE_FIELDS.has(k)) continue;
      if (k === 'username') {
        if (typeof v !== 'string' || !/^[-_a-zA-Z0-9]{3,30}$/.test(v)) {
          return NextResponse.json({ error: 'invalid_username' }, { status: 400 });
        }
        patch.username = v;
      } else if (k === 'display_name') {
        if (typeof v !== 'string' || v.length > 60) {
          return NextResponse.json({ error: 'display_name_too_long' }, { status: 400 });
        }
        patch.display_name = v;
      } else if (k === 'avatar_url') {
        if (v !== null && typeof v !== 'string') {
          return NextResponse.json({ error: 'invalid_avatar_url' }, { status: 400 });
        }
        patch.avatar_url = v as string | null;
      } else if (k === 'phone') {
        if (v !== null && typeof v !== 'string') {
          return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
        }
        patch.phone = v as string | null;
      }
    }
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'no_editable_fields' }, { status: 400 });
    patch['updated_at'] = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    // Type workaround: explicit cast to generated Update type to avoid 'never' inference
    // Temporary any-cast due to Supabase type inference issue with minimized Database schema.
    const { error } = await (supabase as any)
      .from('user_profiles')
      .update(patch as any)
      .eq('user_id', userId);
    if (error) {
      // Unique violation (e.g., username already taken)
      if ((error as unknown as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'conflict' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'unexpected' }, { status: 500 });
  }
}
