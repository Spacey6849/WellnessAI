import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function isAdmin(req: NextRequest) {
  return req.headers.get('x-role') === 'admin';
}

interface AppSettingRow { key: string; value: unknown; description?: string | null; updated_at?: string }
interface AppSettingInsert { key: string; value: unknown }
interface MinimalSettingsBuilder {
  select(cols: string): MinimalSettingsBuilder;
  order(col: string, opts: { ascending: boolean }): Promise<{ data: AppSettingRow[] | null; error: { message: string } | null }>;
  upsert(val: AppSettingInsert, opts: { onConflict: string }): Promise<{ data: AppSettingRow[] | null; error: { message: string } | null }>;
}

// GET: list all app_settings rows
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const builder = supabase.from('app_settings') as unknown as MinimalSettingsBuilder;
    const { data, error } = await builder
      .select('key,value,description,updated_at')
      .order('key', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ settings: data || [] });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

interface PostBody { key?: string; value?: unknown }

// POST: upsert a single setting (admin only)
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json() as PostBody | null;
    const key = body?.key?.trim();
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
    const value = body?.value ?? null;
    const supabase = getSupabaseAdmin();
    const builder = supabase.from('app_settings') as unknown as MinimalSettingsBuilder;
    const { error } = await builder.upsert({ key, value }, { onConflict: 'key' });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';