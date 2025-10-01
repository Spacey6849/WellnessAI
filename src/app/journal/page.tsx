"use client";
import { useEffect, useState, useCallback } from 'react';
import { NotebookPen, RefreshCw, Search, Brain, Calendar, Sparkles, MessageSquare, TrendingUp, BookOpen, Plus, X } from 'lucide-react';

interface JournalEntry { id: string; entry: string; created_at: string; topic?: string | null; mood_snapshot?: number | null }
interface JournalStats { entries: number; topics: number; avgMood: number | null }

export default function JournalPage(){
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<JournalStats>({ entries: 0, topics: 0, avgMood: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'recent' | 'topic'>('all');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newEntryText, setNewEntryText] = useState('');
  const [newEntryTopic, setNewEntryTopic] = useState('');
  const [newEntryMood, setNewEntryMood] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
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

  const handleCreate = async () => {
    if(!userId) return;
    const payload: Record<string, unknown> = { entry: newEntryText.trim() };
    if(newEntryMood) payload.mood_snapshot = newEntryMood;
    if(newEntryTopic.trim()) payload.topic = newEntryTopic.trim();
    if(!newEntryText.trim()) return;
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch('/api/journal', { method:'POST', headers:{ 'Content-Type':'application/json','x-user-id': userId }, body: JSON.stringify(payload) });
      const j = await res.json();
      if(!res.ok) throw new Error(j.error || 'Failed');
      setShowNewModal(false);
      setNewEntryText(''); setNewEntryTopic(''); setNewEntryMood(null);
      fetchEntries();
      // Refresh stats asynchronously
      try { await fetch('/api/journal/stats', { headers:{ 'x-user-id': userId }}); } catch {}
    } catch (e){ setSaveError((e as Error).message); }
    finally { setSaving(false); }
  };

  const moodOptions = [
    { value: 1, emoji: '😢', label: 'Very Low' },
    { value: 2, emoji: '😔', label: 'Low' },
    { value: 3, emoji: '😐', label: 'Neutral' },
    { value: 4, emoji: '😊', label: 'Good' },
    { value: 5, emoji: '😄', label: 'Great' }
  ];

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !searchTerm || 
      entry.entry.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.topic && entry.topic.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = selectedFilter === 'all' || 
      (selectedFilter === 'recent' && new Date(entry.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (selectedFilter === 'topic' && entry.topic);
    
    return matchesSearch && matchesFilter;
  });

  // Stats now sourced from /api/journal/stats (unique topics count handled there)

  useEffect(()=>{ fetchEntries(); },[fetchEntries]);
  useEffect(()=>{
    if(!userId) return;
    (async()=>{
      try {
        const r = await fetch('/api/journal/stats', { headers:{ 'x-user-id': userId }});
        const j = await r.json();
        if(r.ok){ setStats({ entries: j.entries, topics: j.topics, avgMood: j.avgMood }); }
      } catch {/* ignore */}
    })();
  },[userId]);

  return (
    <div className="mx-auto w-full max-w-6xl pb-24">
      {/* Enhanced Header */}
      <header className="py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white flex items-center gap-4">
              <div className="rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 p-3 border border-rose-500/20">
                <NotebookPen className="h-8 w-8 text-rose-300"/>
              </div>
              My Journal
            </h1>
            <p className="mt-3 text-slate-300 max-w-2xl leading-relaxed">
              Your personal space for reflection, growth, and mindfulness. Capture thoughts, track moods, and discover patterns over time.
            </p>
          </div>
          
          {/* Stats Cards */}
          <div className="flex flex-wrap gap-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3 text-center backdrop-blur-xl">
              <div className="text-2xl font-bold text-white">{stats.entries}</div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Entries</div>
            </div>
            {stats.avgMood != null && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3 text-center backdrop-blur-xl">
                <div className="text-2xl font-bold text-emerald-300">{stats.avgMood.toFixed(1)}</div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Avg Mood</div>
              </div>
            )}
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3 text-center backdrop-blur-xl">
              <div className="text-2xl font-bold text-blue-300">{stats.topics}</div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Topics</div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={()=> setShowNewModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/20 px-4 py-3 text-sm font-medium text-rose-100 backdrop-blur-xl hover:bg-rose-500/30 hover:border-rose-400/50"
            >
              <Plus className="h-4 w-4"/> New Entry
            </button>
            
            <button className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 backdrop-blur-xl hover:bg-white/10">
              <Brain className="h-4 w-4 text-purple-300"/> AI Insights
            </button>
            
            <button className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 backdrop-blur-xl hover:bg-white/10">
              <TrendingUp className="h-4 w-4 text-blue-300"/> Mood Trends
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
              <input
                type="text"
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 rounded-full border border-white/15 bg-black/40 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:border-rose-400/50 focus:outline-none focus:ring-2 focus:ring-rose-400/20"
              />
            </div>
            
            {/* Filter */}
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value as 'all' | 'recent' | 'topic')}
              className="rounded-full border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white focus:border-rose-400/50 focus:outline-none focus:ring-2 focus:ring-rose-400/20"
            >
              <option value="all">All Entries</option>
              <option value="recent">Last 7 Days</option>
              <option value="topic">With Topics</option>
            </select>
            
            <button 
              onClick={fetchEntries} 
              className="rounded-full border border-white/15 bg-white/5 p-2.5 text-slate-200 hover:bg-white/10"
              aria-label="Refresh entries"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200 backdrop-blur-xl">
          ⚠️ {error}
        </div>
      )}

      {/* New entry form removed */}

      {/* AI Insights Suggestion */}
      {entries.length >= 3 && (
        <div className="mb-8 rounded-3xl border border-purple-500/20 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 p-6 backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-purple-500/20 p-2">
              <Sparkles className="h-5 w-5 text-purple-300"/>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">🎯 AI-Powered Insights Available</h3>
              <p className="text-sm text-slate-300 mb-4">
                I can analyze your journal entries to provide personalized insights about mood patterns, recurring themes, and suggest reflection prompts.
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex items-center gap-2 rounded-full bg-purple-500/20 px-4 py-2 text-xs font-medium text-purple-200 hover:bg-purple-500/30">
                  <Brain className="h-3 w-3"/> Analyze Patterns
                </button>
                <button className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-4 py-2 text-xs font-medium text-blue-200 hover:bg-blue-500/30">
                  <MessageSquare className="h-3 w-3"/> Get Reflection Prompts
                </button>
                <button className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-4 py-2 text-xs font-medium text-indigo-200 hover:bg-indigo-500/30">
                  <TrendingUp className="h-3 w-3"/> Mood Timeline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Entries List */}
      <div className="space-y-6">
        {filteredEntries.map(entry => {
          const isExpanded = expandedEntry === entry.id;
          const content = isExpanded ? entry.entry : (entry.entry.length > 280 ? entry.entry.slice(0,280) + '...' : entry.entry);
          const mood = entry.mood_snapshot ? moodOptions.find(m => m.value === entry.mood_snapshot) : null;
          
          return (
            <article key={entry.id} className="group rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 p-8 shadow-xl shadow-black/20 backdrop-blur-xl transition hover:border-white/20 hover:shadow-2xl hover:shadow-rose-500/5">
              <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    {entry.topic && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-200 border border-rose-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        {entry.topic}
                      </span>
                    )}
                    {mood && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 border border-white/10">
                        <span className="text-sm">{mood.emoji}</span>
                        {mood.label}
                      </span>
                    )}
                  </div>
                  <time className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400" dateTime={entry.created_at}>
                    <Calendar className="h-3 w-3"/>
                    {new Date(entry.created_at).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </time>
                </div>
              </header>
              
              <div className="prose prose-invert max-w-none">
                <p className="whitespace-pre-line text-slate-100/90 leading-relaxed">{content}</p>
              </div>
              
              {entry.entry.length > 280 && (
                <button
                  onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                  className="mt-4 text-sm font-medium text-rose-300 hover:text-rose-200 transition"
                >
                  {isExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </article>
          );
        })}
        
        {filteredEntries.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="rounded-2xl bg-slate-800/50 border border-white/10 p-8 inline-block">
              <BookOpen className="h-12 w-12 text-slate-400 mx-auto mb-4"/>
              <p className="text-slate-400 mb-2">
                {searchTerm || selectedFilter !== 'all' ? 'No entries match your search.' : 'No entries yet.'}
              </p>
              <p className="text-sm text-slate-500">
                {!searchTerm && selectedFilter === 'all' && 'Start your journaling journey by writing your first entry.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-lg relative">
            <button aria-label="Close" onClick={()=> setShowNewModal(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-200"><X className="h-5 w-5"/></button>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4"><NotebookPen className="h-5 w-5 text-rose-300"/> New Journal Entry</h2>
            {saveError && <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{saveError}</div>}
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">Topic (optional)</label>
                <input value={newEntryTopic} onChange={e=> setNewEntryTopic(e.target.value)} maxLength={120} placeholder="e.g. stress, gratitude" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-rose-400/50 focus:outline-none focus:ring-2 focus:ring-rose-400/20" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">Mood (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {moodOptions.map(m => (
                    <button key={m.value} type="button" onClick={()=> setNewEntryMood(m.value)} className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${newEntryMood===m.value? 'border-rose-400 bg-rose-500/20 text-rose-100':'border-white/10 bg-white/5 text-slate-300 hover:border-white/25'}`}>{m.emoji} {m.label}</button>
                  ))}
                  {newEntryMood && <button type="button" onClick={()=> setNewEntryMood(null)} className="text-xs underline text-slate-400 ml-1">Clear</button>}
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2">Entry</label>
                <textarea value={newEntryText} onChange={e=> setNewEntryText(e.target.value)} rows={6} placeholder="Write freely..." className="w-full resize-y rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:border-rose-400/50 focus:outline-none focus:ring-2 focus:ring-rose-400/20" />
                <div className="mt-1 text-right text-[11px] text-slate-500">{newEntryText.length}/8000</div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={()=> setShowNewModal(false)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300 hover:bg-white/10">Cancel</button>
                <button type="button" disabled={!newEntryText.trim() || saving} onClick={handleCreate} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-2 text-sm font-semibold text-white shadow disabled:opacity-40">
                  {saving ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
