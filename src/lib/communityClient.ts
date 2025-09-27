import { createSupabaseBrowserClient } from './supabaseClient';

// Helper functions that operate directly against Supabase with RLS.
// These are only used client-side when Supabase env + authenticated session are present.

export interface CommunityPost {
  id: string; topic?: string; category?: string; content: string;
  likes: string[]; reply_count: number; created_at: string; updated_at: string;
  // Optional relational category meta (only present if extended view exists)
  category_id?: string | null; category_slug?: string | null; category_label?: string | null;
}
export interface CommunityReply { id: string; post_id: string; content: string; created_at: string; }

function hasSupabaseEnv() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

// Narrow unknown to object with id
function ensureId(row: unknown): { id: string } {
  if (typeof row === 'object' && row !== null) {
    const maybe = row as Record<string, unknown>;
    if (typeof maybe.id === 'string') return { id: maybe.id };
  }
  throw new Error('Insert did not return id');
}

export async function listPosts(limit = 30): Promise<CommunityPost[]> {
  if (!hasSupabaseEnv()) throw new Error('Supabase env missing');
  const supabase = createSupabaseBrowserClient();
  // Try extended view first for category metadata
  let data; // will hold final rows
  const { data: extData, error: extErr } = await supabase
    .from('community_posts_public_extended')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (extErr) {
    // Fallback to legacy public view
    const fallback = await supabase
      .from('community_posts_public')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (fallback.error) throw fallback.error;
    data = fallback.data;
  }
  else {
    data = extData;
  }
  return data as unknown as CommunityPost[];
}

export async function createPost(input: { content: string; topic?: string; category?: string; categorySlug?: string }) {
  if (!hasSupabaseEnv()) throw new Error('Supabase env missing');
  const supabase = createSupabaseBrowserClient();

  // If we have a categorySlug attempt to resolve to category_id
  let category_id: string | null = null;
  if (input.categorySlug) {
    const { data: catRow, error: catErr } = await supabase
      .from('community_categories')
      .select('id')
      .eq('slug', input.categorySlug)
      .single();
    if (!catErr && catRow && typeof (catRow as { id?: unknown }).id === 'string') {
      category_id = (catRow as { id: string }).id;
    }
  }

  const insertPayload: Record<string, unknown> = {
    content: input.content,
    topic: input.topic || null,
    category: input.category || null, // legacy text column
    category_id: category_id, // new relational link (nullable)
  };
  const { data, error } = await supabase
    .from('community_posts')
    .insert(insertPayload as never)
    .select('id')
    .single();
  if (error) throw error;
  const insertRow = ensureId(data);

  // Fetch from extended view first for enriched metadata
  let row; // enriched row
  const { data: extRow, error: extFetchErr } = await supabase
    .from('community_posts_public_extended')
    .select('*')
    .eq('id', insertRow.id)
    .single();
  if (extFetchErr) {
    const legacy = await supabase
      .from('community_posts_public')
      .select('*')
      .eq('id', insertRow.id)
      .single();
    if (legacy.error) throw legacy.error;
    row = legacy.data;
  } else { row = extRow; }
  if (!row) throw new Error('Insert fetch failed');
  return row as unknown as CommunityPost;
}

export async function toggleLike(postId: string) {
  if (!hasSupabaseEnv()) throw new Error('Supabase env missing');
  const supabase = createSupabaseBrowserClient();
  // Use RPC (will enforce auth.uid())
  type RpcResult = { data: unknown; error: { message: string } | null };
  const { error } = await (supabase.rpc as unknown as (fn: string, args: { p_post_id: string }) => Promise<RpcResult>)('toggle_post_like', { p_post_id: postId });
  if (error) throw error;
  const { data: row, error: fetchErr } = await supabase
    .from('community_posts_public')
    .select('*')
    .eq('id', postId)
    .single();
  if (fetchErr) throw fetchErr;
  return row as CommunityPost;
}

export async function listReplies(postId: string): Promise<CommunityReply[]> {
  if (!hasSupabaseEnv()) throw new Error('Supabase env missing');
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('community_replies')
    .select('id, post_id, content, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as unknown as CommunityReply[];
}

export async function createReply(postId: string, content: string) {
  if (!hasSupabaseEnv()) throw new Error('Supabase env missing');
  const supabase = createSupabaseBrowserClient();
  const replyPayload = { post_id: postId, content } as unknown as never; // cast for placeholder types
  const { data, error } = await supabase
    .from('community_replies')
    .insert(replyPayload)
    .select('id, post_id, content, created_at')
    .single();
  if (error) throw error;
  return data as CommunityReply;
}
