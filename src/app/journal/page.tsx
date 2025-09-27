"use client";
import { useEffect, useState, useCallback } from 'react';
import { NotebookPen, RefreshCw } from 'lucide-react';

interface JournalEntry { id: string; entry: string; created_at: string; topic?: string | null }

export default function JournalPage(){
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = typeof window !== 'undefined' ? window.localStorage.getItem('wellnessai:user_id') : null;

  const fetchEntries = useCallback(async () => {
    if(!userId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/journal?limit=200', { headers:{ 'x-user-id': userId }});
      const j = await res.json();
      if(res.ok) setEntries(j.entries || []); else setError(j.error || 'Failed to load');
    } catch (err){ setError((err as Error).message); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(()=>{ fetchEntries(); },[fetchEntries]);

  return (
    <div className="mx-auto w-full max-w-4xl pb-24">
      <header className="flex items-center justify-between py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white flex items-center gap-3"><NotebookPen className="h-7 w-7 text-rose-300"/> My Journal</h1>
          <p className="mt-2 text-sm text-slate-300 max-w-prose">Browse and reflect on your previous entries. Topics help you filter patterns later.</p>
        </div>
        <button type="button" onClick={fetchEntries} className="rounded-full border border-white/10 bg-white/5 p-3 text-slate-200 hover:border-white/30 hover:bg-white/10" aria-label="Refresh entries">
          {loading ? <RefreshCw className="h-5 w-5 animate-spin"/> : <RefreshCw className="h-5 w-5"/>}
        </button>
      </header>
      {error && <p className="mb-6 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
      <ul className="space-y-4">
        {entries.map(e => {
          const snippet = e.entry.length > 240 ? e.entry.slice(0,240) + '…' : e.entry;
          return (
            <li key={e.id} className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-slate-200 shadow shadow-rose-500/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  {e.topic && <span className="inline-flex w-fit rounded-full bg-rose-500/15 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-rose-200">{e.topic}</span>}
                  <time className="text-xs uppercase tracking-[0.3em] text-slate-400" dateTime={e.created_at}>{new Date(e.created_at).toLocaleString()}</time>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-100/90">{snippet}</p>
            </li>
          );
        })}
        {entries.length === 0 && !loading && <li className="text-sm text-slate-400">No entries yet.</li>}
      </ul>
    </div>
  );
}
