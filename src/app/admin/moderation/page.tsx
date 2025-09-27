"use client";
import { useEffect, useState } from 'react';

interface Counts { therapists:number; posts:number; replies:number; chats:number; users:number; }

export default function ModerationDashboard(){
  const [counts,setCounts]=useState<Counts|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{(async()=>{
    try {
      // Use admin header for counts (placeholder). Ideally a dedicated API endpoint.
      const queries = await Promise.all([
        fetch('/api/admin/therapists',{headers:{'x-role':'admin'}}).then(r=>r.json()).catch(()=>({therapists:[]})),
        fetch('/api/community/posts').then(r=>r.json()).catch(()=>({posts:[]}))
      ]);
      const therapists = queries[0].therapists||[];
      const posts = queries[1].posts||[];
      // Replies & chats would need endpoints; placeholder zeros for now.
      setCounts({ therapists: therapists.length, posts: posts.length, replies:0, chats:0, users:0 });
    } catch(e){ const err = e as Error; setError(err.message);} finally { setLoading(false);} })();},[]);

  return (
    <div className="mx-auto w-full max-w-5xl py-12 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Moderation Dashboard</h1>
        <p className="text-slate-300 text-sm">Track community & platform health.</p>
      </header>
      {loading && <p className="text-slate-400 text-sm">Loading...</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {counts && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(counts).map(([k,v])=> (
            <div key={k} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{k}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{v}</p>
            </div>
          ))}
        </div>
      )}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Action Center</h2>
        <p className="text-sm text-slate-400">Future: flagged posts, pending verifications, chat abuse signals.</p>
      </section>
    </div>
  );
}