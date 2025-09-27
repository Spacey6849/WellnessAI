import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { addReply, readStore } from '@/lib/communityStore';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

// Local env guard (mirrors posts route pattern)
function hasSupabaseEnv(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

type DBReplyRow = Database['public']['Tables']['community_replies']['Row'];
interface ApiReply { id: string; content: string; createdAt: string; }

function mapReply(row: DBReplyRow): ApiReply {
  return { id: row.id, content: row.content, createdAt: row.created_at };
}

export async function GET(_req: NextRequest, context: { params: { postId: string } } | { params: Promise<{ postId: string }> }) {
  try {
    let postId: string | undefined;
    try {
      const raw = (context as { params: unknown }).params as unknown;
      const isPromise = (val: unknown): val is Promise<unknown> => !!val && typeof val === 'object' && 'then' in (val as Record<string, unknown>);
      const resolved = isPromise(raw) ? await raw : raw;
      if (resolved && typeof resolved === 'object' && 'postId' in resolved) {
        const v = (resolved as { postId?: unknown }).postId;
        if (typeof v === 'string') postId = v;
      }
    } catch {}
    if (!postId) {
      return NextResponse.json({ error: 'postId missing' }, { status: 400 });
    }
    if (!hasSupabaseEnv()) {
      // In-memory fallback
      const store = await readStore();
      const target = store.posts.find(p => p.id === postId);
      if (!target) return NextResponse.json({ replies: [] });
      return NextResponse.json({ replies: target.replies.map(r => ({ id: r.id, content: r.content, createdAt: r.createdAt })) });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('community_replies')
      .select('id, content, created_at, post_id')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const mapped = (data as DBReplyRow[]).map(mapReply);
    return NextResponse.json({ replies: mapped });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: { postId: string } } | { params: Promise<{ postId: string }> }) {
  try {
    let postId: string | undefined;
    try {
      const raw = (context as { params: unknown }).params as unknown;
      const isPromise = (val: unknown): val is Promise<unknown> => !!val && typeof val === 'object' && 'then' in (val as Record<string, unknown>);
      const resolved = isPromise(raw) ? await raw : raw;
      if (resolved && typeof resolved === 'object' && 'postId' in resolved) {
        const v = (resolved as { postId?: unknown }).postId;
        if (typeof v === 'string') postId = v;
      }
    } catch {}
    if (!postId) return NextResponse.json({ error: 'postId missing' }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });
    if (content.length > 1000) return NextResponse.json({ error: 'content too long (max 1000 chars)' }, { status: 400 });

    if (!hasSupabaseEnv()) {
      const reply = await addReply(postId, content, 'me');
      if (!reply) return NextResponse.json({ error: 'post not found' }, { status: 404 });
      return NextResponse.json({ id: reply.id, content: reply.content, createdAt: reply.createdAt }, { status: 201 });
    }

    const supabase = getSupabaseAdmin();
    const authorId = req.headers.get('x-user-id') || '00000000-0000-0000-0000-000000000000';
    type Insert = Database['public']['Tables']['community_replies']['Insert'];
    const payload: Insert = { post_id: postId, content, author_id: authorId };
    // Casting to any until full generated types are added.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('community_replies') as any)
      .insert(payload)
      .select('id, content, created_at, post_id')
      .single();
    if (error) throw error;
    const row = data as DBReplyRow;
    return NextResponse.json(mapReply(row), { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
