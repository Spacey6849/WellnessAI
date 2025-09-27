"use client";

import Link from "next/link";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  ArrowUpRight,
  Bot,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  HeartPulse,
  MessageCircle,
  NotebookPen,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Moon,
  ChevronRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { fetchRecentMoodEntries } from "@/lib/supabase";
import { useSession } from '@/lib/useSession';

// Runtime series fetched from /api/dashboard/summary (weekly granularity). Monthly placeholder collapses into 4 averaged buckets.
type TrendSummary = { days: string[]; mood: number[]; sleep: number[]; health: number[] };

import type { LucideIcon } from 'lucide-react';
interface StatCardData { title: string; value: string; delta: string; helper: string; trend: 'up'|'down'|'flat'; icon: LucideIcon; accent: string; }

const quickActions = [
  {
    title: "AI Companion",
    description: "Chat with your personalized support coach",
    href: "/chatbot",
    icon: Bot,
    color: "from-blue-500/20 via-blue-500/10",
  },
  {
    title: "Therapist Booking",
    description: "Schedule or review upcoming sessions",
    href: "/booking",
    icon: CalendarCheck,
    color: "from-emerald-500/20 via-emerald-500/10",
  },
  {
    title: "Resource Library",
    description: "Find exercises, meditations, and guides",
    href: "/resources",
    icon: FileText,
    color: "from-purple-500/20 via-purple-500/10",
  },
  {
    title: "Community",
    description: "Join discussions and share progress",
    href: "/community",
    icon: Users,
    color: "from-amber-500/20 via-amber-500/10",
  },
];

const SUGGESTIONS = [
  { id: 'breathing', title: '3-min breathing reset', detail: 'Guided by AI Companion' },
  { id: 'gratitude', title: 'Log a gratitude note', detail: 'Boosts mood awareness' },
  { id: 'stretch', title: 'Mindful stretch', detail: 'Release tension before bed' },
  { id: 'journal', title: 'Write a micro-journal', detail: 'Capture one sentence reflection' },
  { id: 'hydrate', title: 'Drink water', detail: 'Hydration supports clarity' },
  { id: 'movement', title: '2-min posture reset', detail: 'Unwind shoulder tension' },
];

const moodOptions = [
  { label: "Excellent", value: "excellent", emoji: "🌞" },
  { label: "Good", value: "good", emoji: "😊" },
  { label: "Okay", value: "okay", emoji: "🙂" },
  { label: "Bad", value: "bad", emoji: "😕" },
  { label: "Awful", value: "awful", emoji: "😞" },
];

interface Indicator { label: string; value: number; color: string }

// Upcoming sessions are now dynamically loaded from /api/bookings/upcoming
interface UpcomingBooking { id: string; therapistId: string | null; therapistName: string | null; date: string; slot: string; sessionType: string | null; notes: string | null }

const timeframeOptions: Array<'weekly'|'monthly'> = ['weekly','monthly'];

function classNames(...values: Array<string | undefined | null | false>) {
  return values.filter(Boolean).join(" ");
}

export default function DashboardPage() {
  const { session } = useSession();
  const displayName = session?.user?.name || (typeof window !== 'undefined' ? (window.localStorage.getItem('wellnessai:username') || '') : '');
  // Derive a friendlier short form (split on space / use before @)
  const friendlyName = displayName
    ? (displayName.includes(' ') ? displayName.split(' ')[0] : displayName.split('@')[0])
    : 'Friend';
  // Health Check multi-step state
  const [selectedMood, setSelectedMood] = useState<string>("okay");
  const [sleepInput, setSleepInput] = useState<string>("");
  const [healthStep, setHealthStep] = useState<1|2>(1); // 1 = mood, 2 = sleep
  const [submittingHealth, setSubmittingHealth] = useState(false);
  const [timeframe, setTimeframe] = useState<'weekly'|'monthly'>("weekly");
  const [journalEntry, setJournalEntry] = useState("");
  const [journalTopic, setJournalTopic] = useState("");
  const [entries, setEntries] = useState<{ id: string; entry: string; created_at: string }[]>([]);
  const [journalSaved, setJournalSaved] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [statCards, setStatCards] = useState<StatCardData[]>([]);
  const [trend, setTrend] = useState<TrendSummary | null>(null);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [sleepHoursLatest, setSleepHoursLatest] = useState<number | null>(null);
  const [focusTasks, setFocusTasks] = useState<typeof SUGGESTIONS>(SUGGESTIONS.slice(0,3));
  const [loadingFocus, setLoadingFocus] = useState(false);
  const [streak, setStreak] = useState<number>(0);
  // loading flag reserved for potential skeleton states (currently unused but kept minimal)
  // const [loadingSummary, setLoadingSummary] = useState(false);
  const userId = typeof window !== 'undefined' ? window.localStorage.getItem('wellnessai:user_id') : null;
  const [upcoming, setUpcoming] = useState<UpcomingBooking[] | null>(null);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  // Daily quote state
  const [dailyQuote, setDailyQuote] = useState<{ quote: string; author: string; date: string; cached?: boolean; regenerated?: boolean }|null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string|null>(null);

  const fetchUpcoming = useCallback(async () => {
    if(!userId) return;
    setLoadingUpcoming(true);
    try {
      const res = await fetch('/api/bookings/upcoming', { headers: { 'x-user-id': userId }});
      const json = await res.json();
      if(res.ok && Array.isArray(json.bookings)) setUpcoming(json.bookings);
      else if(!res.ok) setUpcoming([]);
    } catch { setUpcoming([]); } finally { setLoadingUpcoming(false); }
  }, [userId]);

  const refreshSuggestions = () => {
    const shuffled = [...SUGGESTIONS].sort(()=>Math.random()-0.5).slice(0,3);
    setFocusTasks(shuffled);
  };

  const fetchDailyFocus = async () => {
    setLoadingFocus(true);
    try {
      const res = await fetch('/api/daily-focus');
      const j = await res.json();
      if(res.ok && Array.isArray(j.tasks)) setFocusTasks(j.tasks);
    } finally { setLoadingFocus(false); }
  };

  function mapMoodToScore(val: string){
    switch(val){
      case 'excellent': return 9;
      case 'good': return 7;
      case 'okay': return 5;
      case 'bad': return 3;
      case 'awful': return 1;
      default: return 5;
    }
  }

  const fetchSummary = useCallback(async () => {
    if(!userId) return;
    try {
      // Attempt API summary first for aggregated fields.
      const res = await fetch('/api/dashboard/summary', { headers: { 'x-user-id': userId }});
      if(res.ok){
        const json = await res.json();
        const cards: StatCardData[] = [
          { title: 'Mood Score', value: `${json.moodScore.toFixed(1)}/10`, delta: '+0', helper: 'vs last week', trend: 'flat', icon: HeartPulse, accent: 'from-sky-500/80 via-blue-500/30' },
          { title: 'Sleep Quality', value: `${json.sleepQuality}%`, delta: '+0', helper: '7h goal', trend: 'flat', icon: Clock, accent: 'from-indigo-500/80 via-indigo-500/30' },
          { title: 'AI Sessions', value: `${json.aiSessions}`, delta: '0', helper: 'total', trend: 'flat', icon: MessageCircle, accent: 'from-fuchsia-500/80 via-purple-500/30' },
          { title: 'Community Touches', value: `${json.communityTouches}`, delta: '0', helper: 'posts', trend: 'flat', icon: Users, accent: 'from-emerald-500/80 via-emerald-500/30' },
        ];
        setStatCards(cards);
        setTrend(json.trends);
        setSleepHoursLatest(json.trends.sleep.slice(-1)[0] ?? null);
        setStreak(json.streak || 0);
        const energy = Math.round((json.trends.health.slice(-1)[0] || 0) * 6);
        const focus = Math.round((json.moodScore/10)*100);
        const stress = Math.max(0, 100 - focus);
        setIndicators([
          { label:'Energy', value: energy, color:'bg-blue-400' },
          { label:'Focus', value: focus, color:'bg-indigo-400' },
          { label:'Stress', value: stress, color:'bg-emerald-400' }
        ]);
        return; // success path
      }
    } catch {/* ignore and fallback */}

    // Fallback: build a basic trend from recent mood entries directly (client-side)
    try {
      const recent = await fetchRecentMoodEntries(userId, 14);
      if(recent.length){
        const days = recent.map(r=> new Date(r.created_at).toISOString().slice(0,10));
        const mood = recent.map(r=> r.mood);
        const sleep = recent.map(r=> (r.sleep_hours ?? 0));
        const health = mood.map((m,i)=> (m/10 + (sleep[i] ? Math.min(sleep[i]/8,1) : 0))/2 * 10); // naive composite
        setTrend({ days, mood, sleep, health });
        const latestMood = mood.slice(-1)[0];
        const focus = Math.round((latestMood/10)*100);
        const stress = Math.max(0, 100-focus);
        setIndicators([
          { label:'Energy', value: Math.round((health.slice(-1)[0]||0)*6), color:'bg-blue-400' },
          { label:'Focus', value: focus, color:'bg-indigo-400' },
          { label:'Stress', value: stress, color:'bg-emerald-400' }
        ]);
        setStatCards(prev => prev.length ? prev : [
          { title: 'Mood Score', value: `${(latestMood||0).toFixed(1)}/10`, delta: '+0', helper: 'recent', trend:'flat', icon: HeartPulse, accent:'from-sky-500/80 via-blue-500/30' },
          { title: 'Sleep Quality', value: sleep.slice(-1)[0] ? `${Math.round((Math.min(sleep.slice(-1)[0],8)/8)*100)}%` : '--', delta:'+0', helper:'7h goal', trend:'flat', icon: Clock, accent:'from-indigo-500/80 via-indigo-500/30' },
          { title: 'AI Sessions', value: '0', delta:'0', helper:'total', trend:'flat', icon: MessageCircle, accent:'from-fuchsia-500/80 via-purple-500/30' },
          { title: 'Community Touches', value: '0', delta:'0', helper:'posts', trend:'flat', icon: Users, accent:'from-emerald-500/80 via-emerald-500/30' }
        ]);
      }
    } catch {/* swallow */}
  }, [userId]);

  const fetchJournal = useCallback(async () => {
    if(!userId) return;
    const res = await fetch('/api/journal?limit=5', { headers: { 'x-user-id': userId }});
    const json = await res.json();
    if(res.ok) setEntries(json.entries);
  }, [userId]);

  const loadQuote = useCallback(async (refresh=false) => {
    setQuoteLoading(true); setQuoteError(null);
    try {
      const res = await fetch(`/api/dashboard/quote${refresh?'?refresh=1':''}`, { cache:'no-store' });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Failed to load quote');
      setDailyQuote(data);
    } catch(e: unknown){
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setQuoteError(msg);
    }
    finally { setQuoteLoading(false); }
  }, []);

  useEffect(()=>{ fetchSummary(); fetchJournal(); fetchUpcoming(); refreshSuggestions(); loadQuote(); }, [fetchSummary, fetchJournal, fetchUpcoming, loadQuote]);

  const chartSeries = useMemo(()=>{
    if(!trend) return [];
    if(timeframe==='weekly') return trend.days.map((d,i)=>({ label:d.slice(5), mood: trend.mood[i], sleep: trend.sleep[i], health: trend.health[i] }));
    // monthly: compress into 4 buckets
    const size = Math.ceil(trend.days.length/4);
  const buckets: { label: string; mood: number; sleep: number; health: number }[] = [];
    for(let b=0;b<4;b++){
      const start = b*size; const slice = trend.mood.slice(start,start+size);
      if(slice.length===0) break;
      const avg = (arr:number[])=> arr.reduce((a,c)=>a+c,0)/(arr.length||1);
      buckets.push({ label:`W${b+1}`, mood: avg(trend.mood.slice(start,start+size)), sleep: avg(trend.sleep.slice(start,start+size)), health: avg(trend.health.slice(start,start+size)) });
    }
    return buckets;
  }, [trend, timeframe]);

  // Latest vitals derived for inline snapshot in trends section
  const latestMoodScore = useMemo(() => trend ? trend.mood.slice(-1)[0] ?? null : null, [trend]);
  const latestSleepHours = useMemo(() => {
    if (trend) return trend.sleep.slice(-1)[0] ?? null;
    return sleepHoursLatest;
  }, [trend, sleepHoursLatest]);

  const moodHeadline = useMemo(() => {
    switch (selectedMood) {
      case "excellent":
        return "You’re shining today. Lock in that momentum.";
      case "good":
        return "Steady vibes. Let’s keep you in this zone.";
      case "bad":
        return "A rough patch is okay—try the breathing reset below.";
      case "awful":
        return "We’re here for you. Consider messaging support.";
      default:
        return "Noted. Small adjustments can shift the day.";
    }
  }, [selectedMood]);

  useEffect(() => {
    if (!journalSaved) return;
    const timeout = window.setTimeout(() => setJournalSaved(false), 2800);
    return () => window.clearTimeout(timeout);
  }, [journalSaved]);

  const handleSaveEntry = async () => {
    const trimmed = journalEntry.trim();
    if (!trimmed || !userId) return;
    const payload: Record<string, unknown> = { entry: trimmed };
    if(journalTopic.trim()) payload.topic = journalTopic.trim();
    const res = await fetch('/api/journal', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-user-id': userId }, body: JSON.stringify(payload) });
    if(res.ok){
      setJournalEntry('');
      setJournalTopic('');
      setJournalSaved(true);
      fetchJournal();
    }
  };

  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const currentMood = moodOptions.find((m) => m.value === selectedMood)?.label;
  const lastJournal = entries.length > 0 ? new Date(entries[0].created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : "None yet";

  const heartbeat = async () => {
    if(!userId) return;
    await fetch('/api/activity/heartbeat', { method:'POST', headers:{'Content-Type':'application/json','x-user-id':userId}, body: JSON.stringify({}) });
    fetchSummary();
    refreshSuggestions();
  };

  // Submit combined health check (mood + optional sleep)
  const submitHealthCheck = async () => {
    if(!userId) return;
    setSubmittingHealth(true);
    try {
      const moodScore = mapMoodToScore(selectedMood);
      const sleepVal = sleepInput ? parseFloat(sleepInput) : undefined;
      const body: Record<string, unknown> = { mood: moodScore };
      if(!isNaN(Number(sleepVal))) body.sleep_hours = sleepVal;
      const res = await fetch('/api/health-check', { method:'POST', headers:{'Content-Type':'application/json','x-user-id':userId}, body: JSON.stringify(body) });
      if(res.ok){
        setHealthStep(1);
        setSleepInput('');
        // After successful submission, refresh summary or fallback direct fetch to update chart quickly.
        fetchSummary();
        // Additionally try a direct incremental append for faster UI without waiting network race (optimistic update)
        setTrend(prev => {
          if(!prev) return prev;
          const today = new Date().toISOString().slice(0,10);
            const lastDay = prev.days.slice(-1)[0];
            const moodArr = [...prev.mood];
            const sleepArr = [...prev.sleep];
            const healthArr = [...prev.health];
            if(lastDay === today){
              moodArr[moodArr.length-1] = moodScore;
              if(!isNaN(Number(sleepVal))) sleepArr[sleepArr.length-1] = sleepVal || 0;
              healthArr[healthArr.length-1] = (moodArr[moodArr.length-1]/10 + (sleepArr[sleepArr.length-1] ? Math.min(sleepArr[sleepArr.length-1]/8,1):0))/2 * 10;
              return { ...prev, mood: moodArr, sleep: sleepArr, health: healthArr };
            }
            return {
              days: [...prev.days, today],
              mood: [...moodArr, moodScore],
              sleep: [...sleepArr, !isNaN(Number(sleepVal)) ? sleepVal || 0 : 0],
              health: [...healthArr, (moodScore/10 + (!isNaN(Number(sleepVal)) ? Math.min((sleepVal||0)/8,1):0))/2 * 10]
            };
        });
      }
    } finally { setSubmittingHealth(false); }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 pb-24">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <article className="relative overflow-hidden rounded-4xl border border-white/5 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950 p-10 text-white shadow-2xl shadow-blue-500/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.35),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.25),transparent_60%)]" />
          <div className="relative z-10 flex flex-col gap-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-4 py-1 text-sm font-semibold text-blue-200">
                <Sparkles size={16} /> Wellness Beginner
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.35em] text-slate-200">
                Live
              </span>
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                {`Welcome back, ${friendlyName}!`}
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-slate-100/85">
                Your personalized care loop is synced. Keep logging moods and
                reflections to unlock deeper insights and tailored routines.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryChip
                title="Current mood"
                value={currentMood ?? "Okay"}
                icon={<HeartPulse className="h-4 w-4" />}
              />
              <SummaryChip
                title="Streak"
                value={streak ? `${streak} day${streak===1?'':'s'}` : '0 days'}
                icon={<ShieldCheck className="h-4 w-4" />}
              />
              <SummaryChip
                title="Last journal"
                value={lastJournal}
                icon={<NotebookPen className="h-4 w-4" />}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/booking"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-100"
              >
                Book next check-in <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="/resources"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/40"
              >
                Explore calming routines
              </Link>
              <button
                type="button"
                onClick={heartbeat}
                className="inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/20 px-5 py-2 text-sm font-semibold text-blue-100 shadow shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-500/30"
              >
                Refresh <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </article>

        <aside className="flex h-full flex-col gap-6">
          <article className="rounded-3xl border border-white/5 bg-white/5 p-6 text-slate-100 shadow-xl shadow-blue-500/10 backdrop-blur-xl">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-blue-200">
                  Upcoming
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">Next 72 hours</h2>
              </div>
              <CalendarClock className="h-5 w-5 text-blue-200" />
            </header>
            <ul className="mt-6 space-y-4 text-sm text-slate-200">
              {loadingUpcoming && (
                <li className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-400">Loading…</li>
              )}
              {!loadingUpcoming && upcoming && upcoming.length === 0 && (
                <li className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-400">No upcoming bookings. <Link href="/booking" className="underline text-slate-200">Book one</Link>.</li>
              )}
              {!loadingUpcoming && upcoming && upcoming.length > 0 && upcoming.map(b => {
                const d = new Date(b.date + 'T' + b.slot + ':00');
                const label = b.therapistName ? `Session with ${b.therapistName}` : (b.sessionType || 'Therapist Session');
                const timeFmt = d.toLocaleDateString(undefined,{ weekday:'short'}) + ' • ' + d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
                return (
                  <li key={b.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-200">
                      <Clock className="h-4 w-4" />
                    </span>
                    <div className="space-y-1">
                      <p className="font-medium text-white">{label}</p>
                      <p className="text-xs text-slate-300">{timeFmt}</p>
                      <span className="inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-200">{b.sessionType || 'Scheduled'}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="rounded-3xl border border-white/5 bg-gradient-to-br from-indigo-500/20 via-indigo-500/10 to-transparent p-6 shadow-xl shadow-indigo-500/20">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Quote of the Day</p>
                {quoteError && <p className="mt-3 text-xs text-rose-200">{quoteError}</p>}
                {!quoteError && !dailyQuote && (
                  <p className="mt-3 text-sm text-indigo-100 flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Loading...</p>
                )}
                {dailyQuote && !quoteError && (
                  <div className="mt-3 space-y-2">
                    <p className="text-base text-indigo-50 leading-relaxed">&ldquo;{dailyQuote.quote}&rdquo;</p>
                    <p className="text-xs text-indigo-200">— {dailyQuote.author || 'Unknown'} {dailyQuote.cached && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">cached</span>} {dailyQuote.regenerated && <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">new</span>}</p>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={()=>loadQuote(true)}
                disabled={quoteLoading}
                className="rounded-full border border-white/20 bg-white/10 p-2 text-indigo-100 transition hover:border-white/40 disabled:opacity-50"
                aria-label="Refresh quote"
              >
                <RefreshCw className={quoteLoading?"h-4 w-4 animate-spin":"h-4 w-4"} />
              </button>
            </div>
          </article>
        </aside>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <article
            key={card.title}
            className="group relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/70 p-6 shadow-xl shadow-indigo-500/10 backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-2xl"
          >
            <div
              className={classNames(
                "absolute inset-0 bg-gradient-to-br opacity-0 transition group-hover:opacity-100",
                card.accent,
                "to-transparent"
              )}
            />
            <div className="relative z-10 flex items-start justify-between">
              <span className="rounded-2xl bg-white/10 p-3">
                <card.icon className="h-5 w-5 text-white" />
              </span>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  {card.title}
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {card.value}
                </p>
                <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                  <span
                    className={classNames(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                      card.trend === "up" && "bg-emerald-500/20 text-emerald-200",
                      card.trend === "down" && "bg-rose-500/20 text-rose-200",
                      card.trend === "flat" && "bg-slate-500/10 text-slate-200"
                    )}
                  >
                    {card.delta}
                  </span>
                  <span className="text-slate-300">{card.helper}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <article className="rounded-3xl border border-white/5 bg-slate-900/70 p-8 shadow-xl shadow-indigo-500/10 backdrop-blur-xl">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Wellness trends</h2>
              <p className="text-sm text-slate-400">Track mood, sleep, and health over time.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
              {timeframeOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTimeframe(option)}
                  className={classNames(
                    "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition",
                    timeframe === option
                      ? "bg-white text-slate-900"
                      : "text-slate-200 hover:bg-white/10"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </header>
          <div className="mt-8 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartSeries}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="4 10" />
                <XAxis dataKey="label" stroke="rgba(148,163,184,0.8)" tickLine={false} axisLine={false} />
                <YAxis
                  stroke="rgba(148,163,184,0.8)"
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 10]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15,23,42,0.95)",
                    borderRadius: 16,
                    border: "1px solid rgba(148,163,184,0.2)",
                  }}
                  cursor={{ stroke: "rgba(148,163,184,0.25)", strokeDasharray: 4 }}
                />
                <Legend wrapperStyle={{ color: "rgba(226,232,240,0.8)", paddingTop: 12 }} />
                <Line
                  type="monotone"
                  dataKey="mood"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                  name="Mood"
                />
                <Line
                  type="monotone"
                  dataKey="sleep"
                  stroke="#34d399"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                  name="Sleep (hrs)"
                />
                <Line
                  type="monotone"
                  dataKey="health"
                  stroke="#818cf8"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                  name="Health"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Integrated Core Vitals Snapshot */}
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
            <div className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Vitals snapshot</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Latest mood</p>
                  <p className="mt-2 text-xl font-semibold text-sky-200">{latestMoodScore != null ? latestMoodScore.toFixed(1) : '--'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Sleep (hrs)</p>
                  <p className="mt-2 text-xl font-semibold text-emerald-200">{latestSleepHours != null ? Number(latestSleepHours).toFixed(1) : '--'}</p>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">These reflect your most recent check-ins. Keep consistency for more accurate trend modeling.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Core vitals</h3>
              {indicators.length === 0 ? (
                <p className="mt-4 text-xs text-slate-400">No data yet. Log a Health Check to begin.</p>
              ) : (
                <ul className="mt-5 space-y-4 text-sm text-slate-200">
                  {indicators.map(ind => (
                    <li key={ind.label}>
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-slate-400">
                        <span>{ind.label}</span>
                        <span>{ind.value}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                        <div className={classNames('h-full rounded-full', ind.color)} style={{ width: `${ind.value}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-white/5 bg-slate-900/70 p-8 shadow-xl shadow-indigo-500/10 backdrop-blur-xl">
          <header>
            <h2 className="text-lg font-semibold text-white">Health Check</h2>
            <p className="mt-1 text-sm text-slate-400">
              {healthStep === 1 ? 'Step 1: Select your current mood.' : 'Step 2: Enter last night\'s sleep (hours).'}
            </p>
          </header>
          {healthStep === 1 && (
            <div className="mt-6 grid gap-3">
              {moodOptions.map((mood) => {
                const isActive = selectedMood === mood.value;
                return (
                  <button
                    key={mood.value}
                    type="button"
                    onClick={() => { setSelectedMood(mood.value); setHealthStep(2); }}
                    className={classNames(
                      "flex items-center justify-between rounded-2xl border px-5 py-3 text-left transition",
                      isActive
                        ? "border-blue-500/70 bg-blue-500/25 text-white shadow-lg shadow-blue-500/20"
                        : "border-white/10 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10"
                    )}
                  >
                    <span className="text-lg font-medium">{mood.label}</span>
                    <span className="text-2xl">{mood.emoji}</span>
                  </button>
                );
              })}
            </div>
          )}
          {healthStep === 2 && (
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-200">Sleep hours</label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Moon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={sleepInput}
                    onChange={e=>setSleepInput(e.target.value)}
                    placeholder={sleepHoursLatest != null ? `${sleepHoursLatest}` : '7.5'}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/30"
                  />
                </div>
                <button
                  type="button"
                  disabled={submittingHealth}
                  onClick={submitHealthCheck}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow shadow-blue-500/25 transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {submittingHealth ? 'Saving...' : 'Submit'} <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button type="button" onClick={()=>{ setHealthStep(1); }} className="text-xs text-slate-400 underline">Change mood</button>
            </div>
          )}
          <p className="mt-5 text-sm text-slate-300">{moodHeadline}</p>
          {sleepHoursLatest != null && (
            <p className="mt-2 text-xs text-slate-400">Last logged sleep: {sleepHoursLatest}h</p>
          )}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            <h3 className="text-xs uppercase tracking-[0.3em] text-slate-400">Suggested next step</h3>
            <p className="mt-3 text-slate-200">Try a guided breath from the AI Companion or write a quick thought in the journal to capture the moment.</p>
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <article className="rounded-3xl border border-white/5 bg-slate-900/70 p-8 shadow-xl shadow-indigo-500/10 backdrop-blur-xl">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">My journal</h2>
              <p className="mt-1 text-sm text-slate-400">
                Capture key emotions or wins from today.
              </p>
            </div>
            <NotebookPen className="h-5 w-5 text-rose-300" />
          </header>
          <div className="mt-6 grid gap-3 sm:grid-cols-[160px_1fr]">
            <div className="flex flex-col gap-2">
              <input
                value={journalTopic}
                onChange={e=>setJournalTopic(e.target.value)}
                maxLength={120}
                placeholder="Topic (optional)"
                className="h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-400/30"
              />
              <button
                type="button"
                onClick={()=>{ if(!userId) return; window.location.href = '/journal'; }}
                className="h-10 rounded-2xl border border-white/10 bg-white/5 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300 transition hover:border-white/25 hover:bg-white/10"
              >View journal</button>
            </div>
            <textarea
            value={journalEntry}
            onChange={(event) => setJournalEntry(event.target.value)}
            placeholder="Write down your thoughts and feelings..."
            className="mt-6 h-32 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/30"
          />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSaveEntry}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-400"
            >
              Save entry
            </button>
            {journalSaved && (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
                Saved
              </span>
            )}
          </div>
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Recent entries
            </h3>
            {entries.length === 0 ? (
              <p className="text-sm text-slate-300">No recent entries yet.</p>
            ) : (
              <ul className="space-y-3">
                {entries.map(e => (
                  <li key={e.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                    {e.entry}
                    <span className="mt-2 block text-[10px] uppercase tracking-[0.3em] text-slate-400">{new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="grid gap-6">
          <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-8 shadow-xl shadow-indigo-500/10 backdrop-blur-xl">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Daily focus</h2>
                <p className="mt-1 text-sm text-slate-400">Pick small resets to keep your streak alive.</p>
              </div>
              <button type="button" onClick={fetchDailyFocus} className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 hover:border-white/30 hover:bg-white/10" aria-label="Refresh tasks">
                {loadingFocus ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </button>
            </header>
            <ul className="mt-6 space-y-3">
              {focusTasks.map((task) => {
                const done = completedTasks.includes(task.id);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className={classNames(
                        "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                        done
                          ? "border-emerald-500/70 bg-emerald-500/20 text-white"
                          : "border-white/10 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10"
                      )}
                    >
                      <span>
                        <span className="text-sm font-semibold text-white">
                          {task.title}
                        </span>
                        <p className="text-xs text-slate-300">{task.detail}</p>
                      </span>
                      <CheckCircle2
                        className={classNames(
                          "h-5 w-5",
                          done ? "text-emerald-200" : "text-slate-400"
                        )}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-white/5 bg-slate-900/70 p-8 shadow-xl shadow-indigo-500/10 backdrop-blur-xl">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Quick actions</h2>
            <p className="mt-1 text-sm text-slate-400">
              Jump back into core areas of the platform.
            </p>
          </div>
          <Bot className="h-5 w-5 text-blue-300" />
        </header>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={classNames(
                "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:border-white/30",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30"
              )}
            >
              <div
                className={classNames(
                  "pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100",
                  "bg-gradient-to-br to-transparent",
                  action.color
                )}
              />
              <div className="relative z-10 flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-lg">
                  <action.icon className="h-5 w-5 text-white" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{action.title}</p>
                  <p className="mt-1 text-xs text-slate-300">{action.description}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-blue-200 transition group-hover:text-white" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

interface SummaryChipProps {
  title: string;
  value: string;
  icon: ReactNode;
}

function SummaryChip({ title, value, icon }: SummaryChipProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm backdrop-blur-xl">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-[0.3em] text-slate-200">
          {title}
        </span>
        <span className="text-sm font-semibold text-white">{value}</span>
      </div>
    </div>
  );
}
