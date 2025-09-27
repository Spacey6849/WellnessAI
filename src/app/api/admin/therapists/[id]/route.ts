import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function isAdmin(req: NextRequest) {
  return req.headers.get('x-role') === 'admin';
}

// Next.js 15 route type inference expects context.params as a Promise in validator generation.
// Accept generic context and resolve params defensively.
export async function DELETE(req: NextRequest, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let id: string | undefined;
  try {
    const rawParams: unknown = (context as { params: unknown }).params;
    const maybeObj = rawParams as { [k: string]: unknown } | Promise<unknown> | null;
    const isPromise = (val: unknown): val is Promise<unknown> =>
      !!val && typeof val === 'object' && 'then' in (val as Record<string, unknown>);
    if (isPromise(maybeObj)) {
      const awaited = await maybeObj as { id?: string };
      if (awaited && typeof awaited.id === 'string') id = awaited.id;
    } else if (maybeObj && typeof maybeObj === 'object') {
      const possible = maybeObj as { id?: unknown };
      if (typeof possible.id === 'string') id = possible.id;
    }
  } catch { /* ignore */ }
  if (!id) return NextResponse.json({ error: 'Invalid id param' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('therapists').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';