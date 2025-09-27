import { NextRequest } from 'next/server';
import { addPost, addReply, likePost, readStore } from '@/lib/communityStore';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- Supabase generated types not fully present yet; local fallbacks below.

// Helper to detect if Supabase is configured
function hasSupabaseEnv() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

interface DBPostRow { id: string; topic: string | null; category: string | null; category_id?: string | null; content: string; likes: string[]; reply_count: number; created_at: string; updated_at: string; category_slug?: string | null; category_label?: string | null; }
interface ApiPost { id: string; topic?: string; category?: string; categoryId?: string; categoryMeta?: { slug: string; label: string } | null; content: string; likes: string[]; replies: unknown[]; createdAt: string; updatedAt: string; }
interface DBReplyRow { id: string; content: string; created_at: string; post_id: string; }

// Local minimal table insert/update typings to satisfy TS before full generation
// Using loose interim types; real generated Supabase types will replace these.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommunityPostInsert = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommunityPostUpdate = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommunityReplyInsert = any;

function mapRow(row: DBPostRow): ApiPost {
  return {
    id: row.id,
    topic: row.topic || undefined,
    category: row.category || undefined, // legacy text
    categoryId: row.category_id || undefined,
    categoryMeta: row.category_slug && row.category_label ? { slug: row.category_slug, label: row.category_label } : null,
    content: row.content,
    likes: row.likes || [],
    replies: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Pagination (optional): ?limit=20
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 100);
  const categorySlug = url.searchParams.get('category');
  if (!hasSupabaseEnv()) {
    const store = await readStore();
    return new Response(JSON.stringify(store.posts), { headers: { 'content-type': 'application/json' } });
  }
  try {
    const supabase = getSupabaseAdmin();
    // Extend view with category join (if a dedicated view with slug/label not present, build manually via RPC style select)
    const query = supabase
      .from('community_posts_public_extended')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    // Fallback if extended view not present: use base view
    let { data, error } = await query as { data: unknown[] | null; error: { message: string } | null };
    if (error && error.message.match(/relationship/)) {
      const base = await supabase
        .from('community_posts_public')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      data = base.data as unknown[] | null;
      error = base.error;
    }
    if (categorySlug && !error && data) {
      // Client filtering if extended view absent
      data = (data as DBPostRow[]).filter(r => r.category_slug === categorySlug || r.category === categorySlug) as unknown[];
    }
    if (error) throw error;
    const mapped = (data as DBPostRow[]).map(mapRow);
    return new Response(JSON.stringify(mapped), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    const err = e as Error;
    return new Response(JSON.stringify({ error: err.message || 'db error' }), { status: 500 });
  }
}

// Create post (anonymous outward – author_id stored but stripped by view)
export async function POST(req: NextRequest) {
  try {
  const { content, topic, category, categorySlug } = await req.json();
    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'content required' }), { status: 400 });
    }
    const trimmedTopic = topic ? String(topic).slice(0,120) : null;
  const trimmedCategory = category ? String(category).slice(0,60) : null; // legacy
  const trimmedSlug = categorySlug ? String(categorySlug).toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,60) : null;

    if (!hasSupabaseEnv()) {
      const post = await addPost(content, 'me', trimmedTopic || undefined, trimmedCategory || undefined);
      return new Response(JSON.stringify(post), { status: 201, headers: { 'content-type': 'application/json' } });
    }
    const supabase = getSupabaseAdmin();
    const authorId = req.headers.get('x-user-id');
    // First try with provided authorId (if any). If FK fails, retry with null (anonymous) before memory fallback.
    let postId: string | null = null;
    let categoryId: string | undefined;
    if (trimmedSlug) {
      const { data: catRow } = await supabase.from('community_categories').select('id').eq('slug', trimmedSlug).single();
      if (catRow) categoryId = (catRow as { id: string }).id;
    }
    let attemptPayload: CommunityPostInsert = { content, topic: trimmedTopic, category: trimmedCategory, category_id: categoryId || null, author_id: authorId || null };
    let first = await supabase.from('community_posts').insert(attemptPayload).select('id').single();
    if (first.error && first.error.code === '23503') {
      // Retry once anonymously
      attemptPayload = { content, topic: trimmedTopic, category: trimmedCategory, category_id: categoryId || null, author_id: null };
      first = await supabase.from('community_posts').insert(attemptPayload).select('id').single();
    }
    if (first.error) {
      // Only now fallback to memory
      const post = await addPost(content, 'me', trimmedTopic || undefined, trimmedCategory || undefined);
      return new Response(JSON.stringify(post), { status: 201, headers: { 'content-type': 'application/json', 'x-source':'memory' } });
    }
    postId = (first.data as { id: string }).id;
    // Try extended view first
    let { data: row, error: rowError } = await supabase
      .from('community_posts_public_extended')
      .select('*')
      .eq('id', postId)
      .single();
    if (rowError) {
      const fallback = await supabase
        .from('community_posts_public')
        .select('*')
        .eq('id', postId)
        .single();
      row = fallback.data;
      rowError = fallback.error;
    }
    if (rowError || !row) throw rowError || new Error('Failed to fetch inserted post');
    return new Response(JSON.stringify(mapRow(row as DBPostRow)), { status: 201, headers: { 'content-type':'application/json','x-source':'db' } });
  } catch (e) {
    const err = e as Error & { code?: string; hint?: string; details?: string };
    return new Response(JSON.stringify({ error: err.message || 'server error', code: err.code, details: err.hint || err.details }), { status: 500 });
  }
}

// Like toggle via PUT { postId }
export async function PUT(req: NextRequest) {
  try {
    const { postId } = await req.json();
    if (!postId) return new Response(JSON.stringify({ error: 'postId required'}), { status: 400 });
    if (!hasSupabaseEnv()) {
      await likePost(postId, 'me');
      const store = await readStore();
      const updated = store.posts.find(p=>p.id===postId);
      if (!updated) return new Response(JSON.stringify({ error: 'not found'}), { status: 404 });
      return new Response(JSON.stringify(updated), { headers: { 'content-type': 'application/json' } });
    }
    const supabase = getSupabaseAdmin();
    const actingUser = req.headers.get('x-user-id');
    if (!actingUser) {
      return new Response(JSON.stringify({ error: 'missing user id header'}), { status: 400 });
    }
    // Manually emulate like toggle instead of RPC (which relies on auth.uid())
    const { data: rowData, error: fetchErr } = await supabase
      .from('community_posts')
      .select('id, likes')
      .eq('id', postId)
      .single();
    if (fetchErr) throw fetchErr;
  const currentLikes: string[] = (rowData && (rowData as unknown as { likes?: string[] }).likes) || [];
    const exists = currentLikes.includes(actingUser);
    const nextLikes = exists ? currentLikes.filter(l=>l!==actingUser) : [...currentLikes, actingUser];
    const updatePayload: CommunityPostUpdate = { likes: nextLikes };
    const { error: updErr } = await supabase
      .from('community_posts')
      // @ts-expect-error missing generated supabase update type
      .update(updatePayload)
      .eq('id', postId);
    if (updErr) throw updErr;
    const { data: pubRow, error: pubErr } = await supabase
      .from('community_posts_public')
      .select('*')
      .eq('id', postId)
      .single();
    if (pubErr) throw pubErr;
    return new Response(JSON.stringify(mapRow(pubRow as DBPostRow)), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    const err = e as Error & { code?: string };
    return new Response(JSON.stringify({ error: err.message || 'server error', code: err.code }), { status: 500 });
  }
}

// Add reply via PATCH { postId, content }
export async function PATCH(req: NextRequest) {
  try {
    const { postId, content } = await req.json();
    if (!postId || !content) return new Response(JSON.stringify({ error: 'postId & content required'}), { status: 400 });
    if (!hasSupabaseEnv()) {
      const reply = await addReply(postId, content, 'me');
      if (!reply) return new Response(JSON.stringify({ error: 'post not found'}), { status: 404 });
      return new Response(JSON.stringify(reply), { status: 201, headers: { 'content-type': 'application/json' } });
    }
    const supabase = getSupabaseAdmin();
    const authorId = req.headers.get('x-user-id');
    let attempt: CommunityReplyInsert = { post_id: postId, content, author_id: authorId || null };
    let inserted = await supabase
      .from('community_replies')
      .insert(attempt)
      .select('id, content, created_at, post_id')
      .single();
    if (inserted.error && inserted.error.code === '23503') {
      attempt = { post_id: postId, content, author_id: null };
      inserted = await supabase
        .from('community_replies')
        .insert(attempt)
        .select('id, content, created_at, post_id')
        .single();
    }
    if (inserted.error) {
      const reply = await addReply(postId, content, 'me');
      if (!reply) return new Response(JSON.stringify({ error: 'post not found'}), { status: 404 });
      return new Response(JSON.stringify(reply), { status: 201, headers: { 'content-type': 'application/json', 'x-source':'memory' } });
    }
  const row = inserted.data as unknown as DBReplyRow;
  const reply = { id: row.id, content: row.content, createdAt: row.created_at, postId: row.post_id };
    return new Response(JSON.stringify(reply), { status: 201, headers: { 'content-type': 'application/json', 'x-source':'db' } });
  } catch (e) {
    const err = e as Error & { code?: string };
    return new Response(JSON.stringify({ error: err.message || 'server error', code: err.code }), { status: 500 });
  }
}
