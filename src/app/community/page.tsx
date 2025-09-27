"use client";
import { useCallback, useEffect, useRef, useState, memo } from "react";
import Image from 'next/image';
import { apiFetch } from '@/lib/apiClient';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { listPosts as sbListPosts, createPost as sbCreatePost, toggleLike as sbToggleLike, listReplies as sbListReplies, createReply as sbCreateReply } from '@/lib/communityClient';

// Narrowed shape returned from Supabase public posts view (no author_id)
interface SbPublicPost { id: string; topic?: string | null; category?: string | null; category_id?: string | null; category_slug?: string | null; category_label?: string | null; content: string; created_at: string; updated_at: string; likes: string[]; reply_count: number; }

interface Reply {
  id: string;
  content: string;
  createdAt: string;
  postId?: string;
  // future: likes? user hash? anonymity metadata
}

interface Post {
  id: string;
  topic?: string;
  category?: string; // legacy text label
  categoryId?: string;
  categoryMeta?: { slug: string; label: string } | null;
  content: string;
  createdAt: string;
  likes: string[]; // anon ids
  replies: Reply[];
}

// Small, memoized UI fragments to reduce re-renders and keep main component lean
const Avatar = memo(function Avatar({ size = 40 }: { size?: number }) {
  return (
    <div
      className="shrink-0 rounded-xl border border-white/10 bg-gradient-to-br from-indigo-800/60 to-blue-900/50 p-0.5 shadow-inner shadow-black/40"
      style={{ width: size, height: size }}
    >
      <div className="flex h-full w-full items-center justify-center rounded-[0.65rem] bg-slate-950/70">
        {/* Use the anon.svg for visual identity */}
        <Image
          src="/anon.svg"
          alt="Anonymous avatar"
          width={size}
          height={size}
          className="h-full w-full rounded-[0.55rem] object-cover opacity-90"
          priority={false}
        />
      </div>
    </div>
  );
});

const Timestamp = ({ value }: { value: string }) => (
  <time
    dateTime={value}
    className="text-[10px] font-medium uppercase tracking-wide text-slate-500/80"
  >
    {new Date(value).toLocaleString()}
  </time>
);

interface ReplyItemProps { reply: Reply }
const ReplyItem = memo(function ReplyItem({ reply }: ReplyItemProps) {
  return (
    <div className="relative flex gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-3 transition hover:border-blue-400/40">
      <div className="absolute left-5 top-0 -translate-x-1/2 -translate-y-4 text-[10px] text-slate-600" aria-hidden>↳</div>
      <Avatar size={34} />
      <div className="flex-1">
        <div className="flex items-center gap-2 pb-1">
          <span className="text-[11px] font-semibold text-slate-300">Anonymous</span>
          <span className="text-slate-600">·</span>
          <Timestamp value={reply.createdAt} />
        </div>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-300">{reply.content}</p>
      </div>
    </div>
  );
});

interface PostCardProps {
  post: Post;
  likeBusy: Record<string, boolean>;
  replyDraft: string;
  setReplyDraft(v: string): void;
  onLike(id: string): void;
  onReply(postId: string): void;
  onToggleReplies(postId: string): void;
  expanded: boolean;
  loadingReplies: boolean;
  usingSupabase: boolean;
  authed: boolean;
}

const PostCard = memo(function PostCard({ post, likeBusy, replyDraft, setReplyDraft, onLike, onReply, onToggleReplies, expanded, loadingReplies, usingSupabase, authed }: PostCardProps) {
  const liked = post.likes.includes('me');
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 p-6 shadow-lg shadow-black/40 ring-1 ring-white/5 transition hover:shadow-blue-900/30">
      <div className="flex items-start gap-4">
        <Avatar />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-slate-300">Anonymous</span>
            <Timestamp value={post.createdAt} />
            <button
              type="button"
              onClick={() => onToggleReplies(post.id)}
              className="text-[10px] text-slate-500 hover:text-blue-300 transition underline-offset-2 hover:underline focus:outline-none"
            >
              · {post.replies.length} repl{post.replies.length === 1 ? 'y' : 'ies'} {post.replies.length>0 && (expanded ? '▴' : '▾')}
            </button>
            {post.category && <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-300">{post.category}</span>}
          </div>
          {post.topic && <h3 className="text-sm font-semibold text-slate-100">{post.topic}</h3>}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
            {post.content}
          </p>
          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={() => onLike(post.id)}
              disabled={!!likeBusy[post.id]}
              className={`group/like flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${liked ? 'border-blue-500/60 bg-blue-500/10 text-blue-400 hover:border-blue-400' : 'border-white/10 bg-white/5 text-slate-400 hover:border-blue-300/40 hover:text-blue-300'}`}
            >
              <span className={liked ? 'animate-pulse' : ''}>❤</span>
              {post.likes.length}
            </button>
          </div>
        </div>
      </div>

      {/* Replies */}
      {expanded && (
        <div className="mt-5 space-y-2 border-t border-white/5 pt-5">
          {loadingReplies && post.replies.length === 0 && (
            <p className="text-[11px] text-slate-500">Loading replies...</p>
          )}
          {post.replies.length === 0 && !loadingReplies && (
            <p className="text-[11px] text-slate-600">No replies yet.</p>
          )}
          {post.replies.map(r => <ReplyItem key={r.id} reply={r} />)}
        </div>
      )}

      {/* Reply composer */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
        <textarea
          rows={2}
          placeholder="Reply anonymously..."
          value={replyDraft}
          onChange={(e) => setReplyDraft(e.target.value)}
          className="w-full resize-none rounded-xl border border-white/10 bg-black/40 p-2 text-xs text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
        />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Be kind • No personal info.</span>
            <button
              onClick={() => onReply(post.id)}
              disabled={!replyDraft.trim() || (usingSupabase && !authed)}
              className="rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow shadow-emerald-800/30 transition hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-40"
            >
              {(usingSupabase && !authed) ? 'Sign in' : 'Reply'}
            </button>
          </div>
        </div>
    </article>
  );
});

function hasSupabaseEnv() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function CommunityPageInner() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState(""); // legacy free text selection (kept for backward compatibility)
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [categories, setCategories] = useState<{ slug: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usingSupabase, setUsingSupabase] = useState(false);
  const [authed, setAuthed] = useState(false);
  const replyDrafts = useRef<Record<string, string>>({});
  const [likeBusy, setLikeBusy] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});

  // Decide at runtime whether to use direct Supabase (if env + session) else fallback API.
  const detectMode = useCallback(async () => {
    if (!hasSupabaseEnv()) {
      setUsingSupabase(false); setAuthed(false); return; }
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      setAuthed(!!session);
      setUsingSupabase(!!session); // Only use direct mode if authenticated (RLS requires auth for inserts/likes)
    } catch { setUsingSupabase(false); setAuthed(false); }
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (usingSupabase) {
        const rows = await sbListPosts();
        const mapped: Post[] = (rows as unknown as SbPublicPost[]).map(r => ({
          id: r.id,
          topic: r.topic || undefined,
          category: r.category || r.category_label || undefined,
          categoryId: r.category_id || undefined,
          categoryMeta: (r.category_slug && r.category_label) ? { slug: r.category_slug, label: r.category_label } : null,
          content: r.content,
          createdAt: r.created_at,
          likes: r.likes || [],
          replies: []
        })).filter(p => !categorySlug || p.categoryMeta?.slug === categorySlug || p.category === categorySlug);
        setPosts(mapped);
      } else {
        const qp = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : '';
        const res = await apiFetch(`/api/community/posts${qp}`, { cache: 'no-store' });
        const data = await res.json();
        const mapped: Post[] = (data as SbPublicPost[]).map(r => ({
          id: r.id,
          topic: r.topic || undefined,
          category: r.category || r.category_label || undefined,
          categoryId: r.category_id || undefined,
          categoryMeta: (r.category_slug && r.category_label) ? { slug: r.category_slug, label: r.category_label } : null,
          content: r.content,
          createdAt: r.created_at,
          likes: r.likes || [],
          replies: []
        }));
        setPosts(mapped);
      }
    } catch {
      setError('Failed to load posts');
    } finally { setLoading(false); }
  }, [usingSupabase, categorySlug]);

  useEffect(() => { detectMode().then(fetchPosts); }, [detectMode, fetchPosts]);

  // Load categories list (public) from Supabase app_settings or direct table via API route (we'll query categories table directly through fallback API soon; for now static matches schema seeds if not available)
  useEffect(() => {
    async function loadCats(){
      try {
        // Try direct client-side fetch from a lightweight endpoint (not yet implemented) fallback to static seeds
        const seeds = ['anxiety','depression','mindfulness','sleep','stress','relationships','self-esteem','trauma','nutrition','movement'];
        const labels: Record<string,string> = { anxiety:'Anxiety Support', depression:'Depression Support', mindfulness:'Mindfulness', sleep:'Sleep Health', stress:'Stress Relief', relationships:'Relationships', 'self-esteem':'Self-Esteem', trauma:'Trauma Recovery', nutrition:'Nutrition', movement:'Movement' };
        setCategories(seeds.map(s=>({ slug:s, label: labels[s]||s })));
      } catch { /* ignore */ }
    }
    loadCats();
  }, []);

  // Listen for auth state changes to switch modes dynamically.
  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    const supabase = createSupabaseBrowserClient();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      setUsingSupabase(!!session);
      fetchPosts();
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [fetchPosts]);

  async function submitPost() {
    if (!newPost.trim()) return;
    if (usingSupabase && !authed) { setError('Sign in required to post'); return; }
    setCreating(true); setError(null);
    const optimistic: Post = { id: 'temp-'+Date.now(), topic: topic.trim() || undefined, category: category || undefined, categoryMeta: categorySlug ? { slug: categorySlug, label: categories.find(c=>c.slug===categorySlug)?.label || categorySlug } : null, content: newPost.trim(), createdAt: new Date().toISOString(), likes: [], replies: [] };
    setPosts(p => [optimistic, ...p]);
    const resetInputs = () => { setNewPost(""); setTopic(""); setCategory(""); setCategorySlug(""); };
    resetInputs();
    try {
      if (usingSupabase) {
        const saved = await sbCreatePost({ content: optimistic.content, topic: optimistic.topic, category: optimistic.category, categorySlug: categorySlug || undefined });
        const s = saved as unknown as SbPublicPost;
        setPosts(p => p.map(x => x.id === optimistic.id ? ({ id: s.id, topic: s.topic || undefined, category: s.category || s.category_label || undefined, categoryId: s.category_id || undefined, categoryMeta: (s.category_slug && s.category_label) ? { slug: s.category_slug, label: s.category_label } : null, content: s.content, createdAt: s.created_at, likes: s.likes || [], replies: [] }) : x));
      } else {
        const res = await apiFetch('/api/community/posts', { method: 'POST', body: JSON.stringify({ content: optimistic.content, topic: optimistic.topic, category: optimistic.category, categorySlug: categorySlug || undefined }) });
        if (!res.ok) throw new Error('Failed');
        const saved = await res.json();
        setPosts(p => p.map(x => x.id === optimistic.id ? saved : x));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not create post';
      setError(msg);
      setPosts(p => p.filter(x => x.id !== optimistic.id));
    } finally { setCreating(false); }
  }

  async function toggleLike(id: string) {
    if (likeBusy[id]) return;
    if (usingSupabase && !authed) { setError('Sign in required to like'); return; }
    setLikeBusy(b => ({ ...b, [id]: true }));
    // optimistic UI (we don't know user id in anon mode; for Supabase we re-fetch row anyway)
    if (!usingSupabase) {
      setPosts(p => p.map(post => {
        if (post.id !== id) return post;
        const liked = post.likes.includes('me');
        return { ...post, likes: liked ? post.likes.filter(l => l !== 'me') : [...post.likes, 'me'] };
      }));
    }
    try {
      if (usingSupabase) {
        const updated = await sbToggleLike(id) as unknown as SbPublicPost;
        setPosts(p => p.map(post => post.id === id ? ({ id: updated.id, topic: updated.topic || undefined, category: updated.category || updated.category_label || undefined, categoryId: updated.category_id || undefined, categoryMeta: (updated.category_slug && updated.category_label) ? { slug: updated.category_slug, label: updated.category_label } : null, content: updated.content, createdAt: updated.created_at, likes: updated.likes || [], replies: post.replies }) : post));
      } else {
        const res = await apiFetch('/api/community/posts', { method: 'PUT', body: JSON.stringify({ postId: id }) });
        if (res.ok) {
          const updated = await res.json();
          setPosts(p => p.map(post => post.id === id ? updated : post));
        }
      }
    } finally { setLikeBusy(b => Object.fromEntries(Object.entries(b).filter(([k]) => k !== id))); }
  }

  async function submitReply(postId: string) {
    const text = replyDrafts.current[postId];
    if (!text || !text.trim()) return;
    if (usingSupabase && !authed) { setError('Sign in required to reply'); return; }
    const optimistic = { id: 'rtemp-'+Date.now(), content: text.trim(), createdAt: new Date().toISOString(), postId } as Reply;
    // In fallback mode: optimistic. In Supabase mode: we will append after actual insert (avoid showing if fails)
    if (!usingSupabase) {
      setPosts(p => p.map(post => post.id === postId ? { ...post, replies: [...post.replies, optimistic] } : post));
    }
    replyDrafts.current[postId] = "";
    try {
      if (usingSupabase) {
        const saved = await sbCreateReply(postId, optimistic.content);
        setPosts(p => p.map(post => post.id === postId ? { ...post, replies: [...post.replies, { id: saved.id, content: saved.content, createdAt: saved.created_at, postId }] } : post));
      } else {
        const res = await apiFetch('/api/community/posts', { method: 'PATCH', body: JSON.stringify({ postId, content: optimistic.content }) });
        if (res.ok) {
          const saved = await res.json();
          setPosts(p => p.map(post => post.id === postId ? { ...post, replies: post.replies.map(r => r.id === optimistic.id ? saved : r) } : post));
        }
      }
    } catch {
      if (!usingSupabase) {
        setPosts(p => p.map(post => post.id === postId ? { ...post, replies: post.replies.filter(r => r.id !== optimistic.id) } : post));
      } else {
        setError('Could not send reply');
      }
    }
  }

  const toggleReplies = useCallback(async (postId: string) => {
    setExpanded(e => ({ ...e, [postId]: !e[postId] }));
    const target = posts.find(p => p.id === postId);
    if (!target) return;
    const willExpand = !expanded[postId];
    if (willExpand && target.replies.length === 0) {
      setLoadingReplies(l => ({ ...l, [postId]: true }));
      try {
        if (usingSupabase) {
          const rows = await sbListReplies(postId);
          const mapped: Reply[] = rows.map(r => ({ id: r.id, content: r.content, createdAt: r.created_at, postId: r.post_id }));
          setPosts(p => p.map(post => post.id === postId ? { ...post, replies: mapped } : post));
        } else {
          const res = await apiFetch(`/api/community/replies/${postId}`, { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            const loaded: Reply[] = json.replies || [];
            setPosts(p => p.map(post => post.id === postId ? { ...post, replies: loaded } : post));
          }
        }
      } finally { setLoadingReplies(l => ({ ...l, [postId]: false })); }
    }
  }, [posts, expanded, usingSupabase]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 pb-24">
      {/* Composer */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-blue-950/60 p-8 shadow-2xl shadow-purple-900/30 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,#312e81,transparent_60%),radial-gradient(circle_at_80%_30%,#1e3a8a,transparent_55%)]" />
        <div className="relative">
          <div className="flex items-start gap-5">
            <Avatar size={54} />
            <div className="flex-1">
              <h1 className="text-3xl font-semibold text-white">Community Hub</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-300">Share support, encouragement, or gratitude. Everything is anonymous. Be kind. No personal info.</p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4 shadow-inner shadow-black/40">
                <div className="mb-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <input
                      type="text"
                      maxLength={120}
                      value={topic}
                      onChange={e=>setTopic(e.target.value)}
                      placeholder="Topic (optional)"
                      className="w-full rounded-xl border border-white/10 bg-black/50 p-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30"
                    />
                  </div>
                  <div>
                    <select
                      value={category}
                      onChange={e=>setCategory(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/50 p-3 text-xs text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30"
                    >
                      <option value="">Select category</option>
                      {['Mindfulness','Stress Relief','Sleep','Nutrition','Movement','Anxiety Support','Depression Support','Motivation','Self-Compassion','Gratitude'].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      value={categorySlug}
                      onChange={e=>{ setCategorySlug(e.target.value); fetchPosts(); }}
                      className="w-full rounded-xl border border-white/10 bg-black/50 p-3 text-xs text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30"
                    >
                      <option value="">Filter: All categories</option>
                      {categories.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <textarea
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/50 p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30"
                  rows={4}
                  placeholder="Share a thought, feeling, or gratitude..."
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                />
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Posting as <strong className="font-semibold text-slate-200">Anonymous</strong></span>
                  <button
                    onClick={submitPost}
                    disabled={creating || !newPost.trim() || (usingSupabase && !authed)}
                    className="group relative rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-2 text-xs font-semibold text-white shadow shadow-blue-900/40 transition hover:from-blue-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="relative z-10">{creating ? 'Posting...' : (usingSupabase && !authed ? 'Sign in required' : 'Post')}</span>
                    <span className="absolute inset-0 -z-0 rounded-full bg-blue-400/0 opacity-0 transition group-hover:bg-blue-400/30 group-hover:opacity-100" />
                  </button>
                </div>
                {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
                {usingSupabase && !authed && (
                  <p className="mt-2 text-[11px] text-amber-400/80">You are viewing posts. Sign in to contribute (posting, likes, replies).</p>
                )}
                {!usingSupabase && hasSupabaseEnv() && (
                  <p className="mt-2 text-[11px] text-slate-500">Running in fallback API mode (not signed in).</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-7">
        {loading && <p className="text-sm text-slate-400">Loading posts...</p>}
        {!loading && posts.length === 0 && <p className="text-sm text-slate-400">No posts yet. Be the first to share.</p>}
        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            likeBusy={likeBusy}
            replyDraft={replyDrafts.current[post.id] || ''}
            setReplyDraft={(v) => { replyDrafts.current[post.id] = v; setPosts(p => [...p]); }}
            onLike={toggleLike}
            onReply={(id) => submitReply(id)}
            onToggleReplies={toggleReplies}
            expanded={!!expanded[post.id]}
            loadingReplies={!!loadingReplies[post.id]}
            usingSupabase={usingSupabase}
            authed={authed}
          />
        ))}
      </section>
    </div>
  );
}

// Export with Suspense boundary to satisfy use client hooks with App Router + build requirement
import { Suspense } from 'react';
export default function CommunityPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl py-24 text-center text-sm text-slate-400">Loading community…</div>}>
      <CommunityPageInner />
    </Suspense>
  );
}
