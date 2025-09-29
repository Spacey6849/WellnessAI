"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from '@/lib/useSession';
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  HeartPulse,
  MapPin,
  ShieldCheck,
  UserCheck,
  // Video icon removed (session type selector UI removed)
  // LogIn icon removed (Google auth removed)
} from "lucide-react";

// ---------------------------------------------------------------------------
// Static Data
// ---------------------------------------------------------------------------
// Removed legacy static fallback list now that booking page fully syncs with DB.

// Dynamic therapist objects (DB-backed) only guarantee a subset of fields; UI supplies graceful fallbacks.
interface Therapist { id: string; name: string; focus: string; bio: string; location?: string; formats?: string[]; languages?: string; expertise?: string[]; rating?: number; }
type TherapistId = Therapist["id"]; 

// Session type selector removed – use fixed label.
const FIXED_SESSION_TYPE = "Video session";

interface AvailabilityDay { date: string; slots: string[] }

// Availability cache (per page lifetime) keyed by therapist id.
const availabilityCache: Record<string, AvailabilityDay[] | undefined> = {};

const infoBullets = [
  {
    title: "Licensed & verified",
    description: "Every therapist is verified and ready for virtual or hybrid care.",
  },
  {
    title: "Tailored matches",
    description: "We surface therapists aligned with your goals and mood trends.",
  },
  {
    title: "Confidential & secure",
    description: "Sessions are end-to-end encrypted with optional journaling prompts.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Deterministic (locale‑independent) date label used for SSR + CSR to avoid hydration mismatches.
// We intentionally do NOT rely on toLocaleDateString because Node (server) and the browser can
// pick different default locales (e.g. en-GB vs en-US) which swaps day/month order and causes the
// "Hydration failed" warning. This formatter guarantees identical output on server & client.
function formatDateKey(dateKey: string) {
  const d = new Date(dateKey + 'T00:00:00Z'); // force UTC midnight to avoid TZ off-by-one
  if (isNaN(d.getTime())) return dateKey; // fallback (should not happen with ISO keys)
  const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${weekdays[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function BookingPage() {
  const [therapists,setTherapists]=useState<Therapist[]>([]);
  const [loading,setLoading]=useState(true);
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistId | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const sessionType = FIXED_SESSION_TYPE; // fixed (selection UI removed)
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [meetUrl, setMeetUrl] = useState<string | null>(null);
  const [calendarEventId, setCalendarEventId] = useState<string | null>(null);
  const [calendarEventLink, setCalendarEventLink] = useState<string | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleExpiresAt, setGoogleExpiresAt] = useState<number | null>(null); // epoch ms
  const [warnings, setWarnings] = useState<string[]>([]);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const { session, status, signOut } = useSession();
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  // Email obtained via Google OAuth (not an app login, just contact convenience)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  // Google / NextAuth removed; meet creation now disabled unless re‑implemented.

  const therapist = useMemo(() => {
    if(!therapists.length) return undefined;
    return therapists.find(t => t.id === selectedTherapist) || therapists[0];
  }, [selectedTherapist, therapists]);

  useEffect(()=>{
    const load=async()=>{
      try {
        const res=await fetch('/api/therapists');
        if(!res.ok) throw new Error('Failed');
        const json=await res.json();
        interface ApiTherapist { id:string; name:string; specialty:string; bio?:string | null }
        const rawList: unknown = json.therapists;
        const mapped:Therapist[] = Array.isArray(rawList) ? rawList.filter((r): r is ApiTherapist => !!r && typeof r === 'object' && 'id' in r && 'name' in r && 'specialty' in r)
          .map(t => ({
            id: t.id,
            name: t.name,
            focus: t.specialty,
            bio: t.bio || '',
            location: 'Virtual',
            formats: ['Video'],
            languages: 'English',
            expertise: [],
            rating: 4.9
          })) : [];
        setTherapists(mapped);
        if(mapped.length) setSelectedTherapist(prev => prev && mapped.some(m => m.id===prev) ? prev : mapped[0].id);
      } catch { /* ignore, keep fallback */ }
      finally { setLoading(false); }
    };
    load();
  },[]);

  // Sync email from credential session
  useEffect(()=>{
    if (session?.user?.email) {
      setAuthEmail(session.user.email);
      setEmail(session.user.email);
    } else {
      setAuthEmail(null);
    }
  },[session]);

  // Hydrate ephemeral Google access token & listen for popup postMessage directly (state verified).
  useEffect(() => {
    // Initial hydration + prune expired
    try {
      const t = sessionStorage.getItem('google_access_token');
      const expRaw = sessionStorage.getItem('google_access_expires');
      if (t) setGoogleToken(t); else setGoogleToken(null);
      if (expRaw) {
        const exp = Number(expRaw);
        if (!isNaN(exp) && Date.now() < exp) {
          setGoogleExpiresAt(exp);
        } else {
          try { sessionStorage.removeItem('google_access_token'); sessionStorage.removeItem('google_access_expires'); } catch {}
          setGoogleExpiresAt(null); setGoogleToken(null);
        }
      } else {
        setGoogleExpiresAt(null);
      }
    } catch {/* ignore */}

    interface OAuthMessageSuccess { type: 'google-oauth-success'; token?: string; state?: string; expiresIn?: number }
    interface OAuthMessageFailure { type: 'google-oauth-failure'; error?: string }
    type OAuthMessage = OAuthMessageSuccess | OAuthMessageFailure | Record<string, unknown>;
    async function onMessage(ev: MessageEvent) {
      const data: OAuthMessage = (ev.data && typeof ev.data === 'object') ? ev.data as OAuthMessage : {};
      if (!data || typeof data !== 'object') return;
      if ((data as OAuthMessageSuccess).type === 'google-oauth-success') {
        const success = data as OAuthMessageSuccess;
        const expected = sessionStorage.getItem('google_oauth_state');
        if (expected && success.state && expected !== success.state) {
          console.warn('Google OAuth state mismatch; ignoring token');
          return;
        }
        sessionStorage.removeItem('google_oauth_state');
        const token: string | undefined = success.token;
        if (!token) return;
        const expiresIn: number = typeof success.expiresIn === 'number' ? success.expiresIn : 3600;
        const expiresAt = Date.now() + Math.max(0, expiresIn - 30) * 1000; // subtract 30s safety margin
        try {
          sessionStorage.setItem('google_access_token', token);
          sessionStorage.setItem('google_access_expires', String(expiresAt));
        } catch {/* ignore */}
        setGoogleToken(token);
        setGoogleExpiresAt(expiresAt);
        // Attempt to fetch user's email purely for contact autofill (not authentication) if none present
        if (!authEmail) {
          try {
            const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` }});
            if (r.ok) {
              const uj = await r.json() as { email?: string };
              if (uj.email) { setGoogleEmail(uj.email); setEmail(uj.email); }
            }
          } catch {/* ignore */}
        }
      } else if ((data as OAuthMessageFailure).type === 'google-oauth-failure') {
        const failure = data as OAuthMessageFailure;
        if (failure.error !== 'popup_closed_by_user') console.warn('Google OAuth failed', failure.error);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [authEmail]);

  // Booked slots fetcher (conflict avoidance)
  const fetchBookedSlots = useCallback(async ()=>{
    if(!selectedTherapist || !selectedDate) return;
    try {
      const res = await fetch(`/api/bookings?therapistId=${selectedTherapist}&date=${selectedDate}`);
      if(!res.ok) return;
      const j = await res.json();
      setBookedSlots(Array.isArray(j.slots)? j.slots: []);
    } catch {/* ignore */}
  },[selectedTherapist, selectedDate]);

  useEffect(()=>{ setBookedSlots([]); if(selectedDate) fetchBookedSlots(); },[selectedDate, selectedTherapist, fetchBookedSlots]);

  // Defensive availability lookup (avoids runtime errors if key missing)
  const [availabilityDays, setAvailabilityDays] = useState<AvailabilityDay[]>([]);

  // Fetch availability when therapist changes
  useEffect(()=>{
    let cancelled = false;
    async function load() {
      if(!selectedTherapist) { setAvailabilityDays([]); return; }
      // Use cache first
      if(availabilityCache[selectedTherapist]) { setAvailabilityDays(availabilityCache[selectedTherapist]!); return; }
      try {
        const res = await fetch(`/api/therapists/availability?therapistId=${selectedTherapist}`);
        if(!res.ok) throw new Error('fail');
  const json = await res.json();
        const rawDays = Array.isArray(json.days) ? json.days : [];
        const days: AvailabilityDay[] = rawDays.filter((d: unknown): d is AvailabilityDay => {
          if(!d || typeof d !== 'object') return false;
          const obj = d as { date?: unknown; slots?: unknown };
          return typeof obj.date === 'string' && Array.isArray(obj.slots) && obj.slots.every(s => typeof s === 'string');
        });
        if(!cancelled) {
          availabilityCache[selectedTherapist] = days;
          setAvailabilityDays(days);
          // Auto-select first date if none chosen or date no longer valid
          if(days.length && (!selectedDate || !days.some(d => d.date === selectedDate))) {
            setSelectedDate(days[0].date);
            setSelectedSlot(null);
          }
        }
      } catch {
        if(!cancelled) setAvailabilityDays([]);
      }
    }
    load();
    return () => { cancelled = true; };
  // We intentionally exclude selectedDate from deps to avoid re-fetch loops; selection reset handled inside when therapist changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selectedTherapist]);

  const therapistAvailability = useMemo(()=>{
    const map: Record<string,string[]> = {};
    availabilityDays.forEach(d => { map[d.date] = d.slots; });
    return map;
  },[availabilityDays]);

  const upcomingDates = useMemo(() => availabilityDays.map(d => d.date), [availabilityDays]);
  const googleTokenValid = useMemo(() => !!googleToken && !!googleExpiresAt && Date.now() < googleExpiresAt, [googleToken, googleExpiresAt]);
  const canSubmit = Boolean(selectedTherapist && selectedDate && selectedSlot && email);
  const currentStep = selectedSlot ? 3 : selectedDate ? 2 : 1;

  const submitBooking = async () => {
    if (!canSubmit || !selectedDate || !selectedSlot || !selectedTherapist) return;
    setBookingError(null);
    // prune expired token just before submission
    if (googleToken && (!googleExpiresAt || Date.now() >= googleExpiresAt)) {
      try { sessionStorage.removeItem('google_access_token'); sessionStorage.removeItem('google_access_expires'); } catch {}
      setGoogleToken(null); setGoogleExpiresAt(null);
    }
    const headers: Record<string,string> = { 'Content-Type':'application/json' };
    if (googleTokenValid && googleToken) headers['x-user-google-token'] = googleToken;
    const res = await fetch('/api/bookings', {
      method:'POST',
      headers,
      body: JSON.stringify({ therapistId: selectedTherapist, date: selectedDate, slot: selectedSlot, sessionType, notes, contactEmail: email, userEmail: authEmail || email })
    });
    if(res.status === 409) {
      setBookingError('That slot was just booked. Please pick another.');
      fetchBookedSlots();
      return;
    }
    if(!res.ok){
      try {
        const j = await res.json();
        setBookingError(j.error || 'Unable to book right now. Try again.');
      } catch {
        setBookingError('Unable to book right now. Try again.');
      }
      return;
    }
    const json = await res.json();
    const mUrl = json.meetUrl || null;
    const evId = json.calendarEventId || null;
    const evLink = json.calendarEventLink || null; // may add later server side
    // Google Meet creation disabled (NextAuth removed). mUrl remains null unless backend provides alternative.
    setMeetUrl(mUrl);
    setCalendarEventId(evId);
    setCalendarEventLink(evLink);
    setWarnings(Array.isArray(json.warnings) ? json.warnings : []);
    setIsSubmitted(true);
    setTimeout(() => setIsSubmitted(false), 4000);
    fetchBookedSlots();
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 pb-28">
      {/* Hero / Intro */}
      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <article className="relative overflow-hidden rounded-4xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/85 to-slate-950 p-12 text-white shadow-2xl shadow-blue-500/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.2),transparent_65%)]" />
            <div className="relative z-10 flex flex-col gap-10">
              <div className="flex flex-col gap-6">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-500/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-blue-100"><ShieldCheck size={14}/> Therapy network</span>
                <div className="space-y-4">
                  <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Book a therapist who understands your rhythm.</h1>
                  <p className="max-w-2xl text-base text-slate-100/90">Discover curated professionals aligned with your mood trends. Choose a slot, leave context, and you&apos;re set — we confirm within minutes.</p>
                </div>
                {/* Progress */}
                <div aria-label="Booking progress" role="list" className="flex items-center gap-4">
                  {[1,2,3].map(step => {
                    const active = step <= currentStep;
                    return (
                      <div key={step} role="listitem" className={`flex flex-1 items-center gap-3 text-[11px] font-semibold tracking-[0.3em] ${active? 'text-blue-100':'text-slate-500'}`}>
                        <span aria-current={active && step===currentStep? 'step':undefined} className={`flex h-9 w-9 items-center justify-center rounded-full border text-[11px] transition ${active? 'border-blue-400/60 bg-blue-500/25 text-white shadow-[0_0_0_3px_rgba(59,130,246,0.25)]':'border-white/10 bg-white/5'}`}>{step}</span>
                        {step<3 && <span className={`h-0.5 flex-1 rounded-full ${currentStep>step? 'bg-blue-400/70':'bg-white/10'}`}/>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {infoBullets.map(b => (
                  <div key={b.title} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-sm text-slate-100">
                    <p className="font-semibold text-white">{b.title}</p>
                    <p className="mt-1 text-slate-200/80">{b.description}</p>
                  </div>
                ))}
              </div>
            </div>
        </article>
        <aside className="flex flex-col gap-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <header className="flex items-center gap-3 text-white">
              <HeartPulse className="h-5 w-5 text-emerald-300"/>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Personalized</p>
                <h2 className="text-lg font-semibold">Suggested matches</h2>
              </div>
            </header>
            <ul className="mt-5 space-y-4 text-sm text-slate-200">
              {loading && (
                <>
                  {[0,1,2].map(i => (
                    <li key={i} className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="h-4 w-40 rounded bg-white/20" />
                      <div className="mt-2 h-3 w-24 rounded bg-white/10" />
                      <div className="mt-3 h-10 w-full rounded bg-white/5" />
                    </li>
                  ))}
                </>
              )}
              {!loading && therapists.map(t => (
                <li key={t.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-slate-300">{t.focus}</p>
                  {t.bio && <p className="mt-2 text-xs text-slate-400">{t.bio}</p>}
                </li>
              ))}
              {!loading && !therapists.length && (
                <li className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">No therapists available yet.</li>
              )}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-6 text-sm text-slate-200 shadow-lg shadow-emerald-500/10">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">Need help choosing?</p>
            <p className="mt-2 text-base text-white">Start a quick AI chat to craft the right note or surface more recommendations.</p>
            <button type="button" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-100">Launch companion <ArrowRight className="h-4 w-4"/></button>
          </div>
        </aside>
      </section>

      {/* Plan Section */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-xl shadow-indigo-500/15 backdrop-blur-xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-white/10 pb-8">
          <div>
            <h2 className="text-2xl font-semibold text-white tracking-tight">Plan your session</h2>
            <p className="mt-2 max-w-lg text-sm text-slate-300">Explore a match, pick a time, and give helpful context. We keep things calm and clear.</p>
          </div>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 px-6 py-2 text-xs font-semibold text-blue-100"><CalendarClock className="h-4 w-4"/> Auto-sync enabled</div>
        </div>
        <div className="mt-10 grid gap-10 lg:grid-cols-3">
          {/* Step 1 */}
          <div className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-inner shadow-black/30 ring-1 ring-white/5">
            <header className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-indigo-300">Step 1</p>
              <h3 className="text-base font-semibold text-white">Therapist & format</h3>
            </header>
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/40 p-2 pr-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
              <ul className="space-y-2">
                {loading && (
                  <>
                    {[0,1,2].map(i => (
                      <li key={i} className="animate-pulse rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-[11px] text-slate-400">Loading…</li>
                    ))}
                  </>
                )}
                {!loading && therapists.map(t => {
                  const active = t.id === selectedTherapist;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        aria-label={`Select therapist ${t.name}`}
                        onClick={() => { setSelectedTherapist(t.id); setSelectedDate(null); setSelectedSlot(null); }}
                        className={`w-full rounded-2xl border px-4 py-4 text-left text-[12px] leading-relaxed transition ${active? 'border-blue-500/70 bg-blue-500/25 text-white shadow-lg shadow-blue-500/30':'border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-white">{t.name}</p>
                            <p className="text-[11px] text-slate-300">{t.focus}</p>
                          </div>
                          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-blue-200 backdrop-blur-sm">{(t.rating ?? 4.9).toFixed(1)} ★</span>
                        </div>
                        {t.bio && <p className="mt-3 line-clamp-2 text-[11px] text-slate-400">{t.bio}</p>}
                      </button>
                    </li>
                  );
                })}
                {!loading && !therapists.length && <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-[11px] text-slate-400">No therapists yet.</li>}
              </ul>
            </div>
            {/* Session type selector removed per request (default remains Video session) */}
          </div>
          {/* Step 2 */}
          <div className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-inner shadow-black/30 ring-1 ring-white/5">
            <header className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-indigo-300">Step 2</p>
              <h3 className="text-base font-semibold text-white">Pick a time</h3>
            </header>
            {upcomingDates.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-[12px] text-slate-200"><AlertCircle className="mb-2 h-5 w-5 text-amber-300"/> Slots will appear once this therapist syncs availability.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {upcomingDates.map(d => {
                  const active = d === selectedDate;
                  const slotCount = therapistAvailability?.[d]?.length ?? 0;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={active}
                      onClick={() => { setSelectedDate(d); setSelectedSlot(null); }}
                      className={`rounded-2xl border px-4 py-4 text-left text-[12px] transition ${active ? 'border-blue-500/70 bg-blue-500/25 text-white shadow shadow-blue-500/30' : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30 hover:bg-white/10'}`}
                    >
                      <p className="font-semibold text-white">{formatDateKey(d)}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{slotCount} slot{slotCount === 1 ? '' : 's'}</p>
                    </button>
                  );
                })}
              </div>
            )}
            {selectedDate && (
              <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-[12px] text-slate-200">
                <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">Slots</p>
                <div className="flex flex-wrap gap-2">
                  {(therapistAvailability?.[selectedDate] ?? []).filter(slot => !bookedSlots.includes(slot)).map(slot => {
                    const active = slot === selectedSlot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-wide transition ${active ? 'bg-white text-slate-900' : 'border border-white/20 bg-transparent text-slate-200 hover:border-white/40'}`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
                {!!bookedSlots.length && (
                  <p className="text-[10px] text-amber-300/80">{bookedSlots.length} slot{bookedSlots.length===1?'':'s'} already booked and hidden.</p>
                )}
              </div>
            )}
          </div>
          {/* Step 3 */}
          <form
            onSubmit={(e) => { e.preventDefault(); submitBooking(); }}
            aria-labelledby="share-context-heading"
            className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-[13px] text-slate-200 shadow-inner shadow-black/30 ring-1 ring-white/5"
          >
            <header className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-indigo-300">Step 3</p>
              <h3 id="share-context-heading" className="text-base font-semibold text-white">Share context</h3>
            </header>
            {/* Authentication status (credential session) */}
            {status === 'loading' && (
              <div className="text-[11px] text-slate-400">Checking session…</div>
            )}
            {status !== 'loading' && authEmail && (
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 font-semibold tracking-[0.3em] text-emerald-200">{authEmail}</span>
                <button
                  type="button"
                  onClick={() => { signOut(); setEmail(''); }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-white/20"
                  aria-label="Sign out"
                >Sign Out</button>
              </div>
            )}
            {status !== 'loading' && !authEmail && !googleEmail && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-[11px] text-blue-200">
                <span className="font-semibold tracking-[0.25em]">Connect Google to auto-fill email</span>
              </div>
            )}
            <label htmlFor="contact-email" className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-300">Contact email</label>
            <input
              id="contact-email"
              value={email}
              disabled
              type="email"
              placeholder={googleEmail || authEmail ? 'Loading…' : 'you@example.com'}
              className="w-full cursor-not-allowed rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-[13px] text-white/90 opacity-80 outline-none"
              aria-readonly="true"
            />
            <label htmlFor="notes" className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-300">Notes (optional)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything helpful for your therapist..."
              className="h-32 w-full resize-none rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-[13px] text-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/30"
            />
            <button
              type="submit"
              disabled={!canSubmit}
              className={`inline-flex items-center justify-center gap-3 rounded-full px-6 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40 ${canSubmit ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400 active:translate-y-px' : 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-400'}`}
            >
              Confirm
            </button>
            {bookingError && <p className="text-[11px] font-semibold text-amber-300">{bookingError}</p>}
            {isSubmitted && (
              <div
                aria-live="polite"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-200"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Request received.
              </div>
            )}
            {meetUrl && (
              <p className="text-[11px] mt-2 break-all text-blue-300">Meet link: <a className="underline hover:text-blue-200" href={meetUrl} target="_blank" rel="noopener noreferrer">{meetUrl}</a></p>
            )}
            {(calendarEventLink || calendarEventId) && (
              <p className="text-[11px] mt-1 break-all text-indigo-300">Calendar event: {calendarEventLink ? (
                <a className="underline hover:text-indigo-200" href={calendarEventLink} target="_blank" rel="noopener noreferrer">Open event</a>
              ) : (
                <span className="text-slate-400">ID: {calendarEventId}</span>
              )}</p>
            )}
            {/* Google Meet / Calendar integration card (inline) */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.35em] text-blue-200">Google Meet</h4>
                {googleTokenValid && (
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-semibold text-emerald-200">Connected</span>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-300">Connect your Google Calendar to auto-create a Google Meet link when you confirm.</p>
              {!googleTokenValid ? (
                <button
                  type="button"
                  onClick={() => {
                    // Use Google OAuth 2.0 directly to match your existing client credentials
                    const clientId = '821762584781-o7h6hvthiq1g5f632ppbgbm04lead7lc.apps.googleusercontent.com';
                    // Use custom lightweight OAuth callback (NextAuth was removed; its endpoint returns 410)
                    const redirectUri = encodeURIComponent(`${window.location.origin}/api/google/oauth/callback`);
                    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events openid email profile');
                    const state = crypto.randomUUID();
                    sessionStorage.setItem('google_oauth_state', state);
                    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                      `client_id=${clientId}&` +
                      `redirect_uri=${redirectUri}&` +
                      `response_type=code&` +
                      `access_type=online&` +
                      `prompt=consent&` +
                      `scope=${scope}&` +
                      `state=${state}`;
                    const w = window.open(authUrl, 'google-oauth', 'width=500,height=650');
                    if (!w) return;
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-900 shadow hover:bg-slate-100"
                >Connect Google</button>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-slate-300">
                  <p>Will attach Meet link on confirm.</p>
                  <button
                    type="button"
                    onClick={() => { setGoogleToken(null); setGoogleExpiresAt(null); try { sessionStorage.removeItem('google_access_token'); sessionStorage.removeItem('google_access_expires'); } catch {} }}
                    className="rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-wide hover:bg-white/10"
                  >Disconnect</button>
                </div>
              )}
              {googleToken && !googleTokenValid && (
                <p className="mt-2 text-[10px] text-amber-300">Token expired – reconnect to create a Meet link.</p>
              )}
            </div>
            {!!warnings.length && (
              <ul className="mt-2 space-y-1 text-[10px] text-amber-300/80">
                {warnings.map(w => <li key={w}>Notice: {w.replace(/_/g,' ')}</li>)}
              </ul>
            )}
          </form>
        </div>
      </section>

      {/* About therapist + Next Steps (moved below main planner) */}
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-300">About your therapist</h3>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
            <header className="flex items-start justify-between">
              <div>
                <p className="text-base font-semibold text-white">{therapist?.name || 'Select a therapist'}</p>
                {therapist && <p className="text-xs text-slate-300">{therapist.focus}</p>}
              </div>
              {therapist && <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-blue-200">{sessionType}</span>}
            </header>
            {therapist ? <p className="mt-4 text-xs text-slate-300">{therapist.bio}</p> : <p className="mt-4 text-xs text-slate-400">Choose a therapist to see their profile.</p>}
            <div className="mt-5 space-y-2 text-xs text-slate-300">
              {therapist && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-200"/> {therapist.location || 'Virtual'}</p>}
              {therapist && <p className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-blue-200"/> Languages: {therapist.languages || 'English'}</p>}
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-200">
              {therapist?.expertise?.map(e => (
                <span key={e} className="rounded-full border border-white/15 bg-white/5 px-3 py-1">{e}</span>
              ))}
            </div>
          </div>
        </article>
        <article className="rounded-3xl border border-white/10 bg-gradient-to-br from-blue-600/15 via-indigo-600/10 to-transparent p-8 text-sm text-slate-200 shadow-xl shadow-blue-900/20 backdrop-blur-xl">
          <h3 className="text-base font-semibold uppercase tracking-[0.4em] text-blue-100">What happens next?</h3>
          <ol className="mt-6 space-y-5">
            <li className="flex items-start gap-4"><span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[12px] font-semibold">1</span> We send your request and supporting notes to your therapist.</li>
            <li className="flex items-start gap-4"><span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[12px] font-semibold">2</span> They confirm the slot or suggest alternatives if needed.</li>
            <li className="flex items-start gap-4"><span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[12px] font-semibold">3</span> A calendar invite plus prep checklist appears in your dashboard.</li>
          </ol>
        </article>
      </section>
    </div>
  );
}

// Listen for OAuth popup messages (placed after component definition to avoid SSR mismatch)
declare global {
  interface Window { __google_oauth_listener_added?: boolean }
  interface GoogleOAuthSuccessMsg { type: 'google-oauth-success'; token: string; expiresIn?: number }
}

if (typeof window !== 'undefined' && !window.__google_oauth_listener_added) {
  window.__google_oauth_listener_added = true;
  window.addEventListener('message', (ev: MessageEvent) => {
    const d = ev.data as Partial<GoogleOAuthSuccessMsg> | null;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'google-oauth-success' && typeof d.token === 'string') {
      window.dispatchEvent(new CustomEvent('google-token-updated', { detail: d }));
    }
  });
}

// Hook token updates into component state via custom event (cannot inside component after export default without refactor; quick injection approach)
// This pattern updates all mounted booking pages (only one) without prop drilling.
if (typeof window !== 'undefined') {
  window.addEventListener('google-token-updated', (e: Event) => {
    const detail = (e as CustomEvent<Partial<GoogleOAuthSuccessMsg>>).detail;
    const token = detail?.token;
    const expiresIn = detail?.expiresIn; // seconds
    if (token) {
      // Store ephemeral token in sessionStorage so component reload picks it up (optional).
      try { sessionStorage.setItem('google_access_token', token); if (expiresIn) sessionStorage.setItem('google_access_expires', String(Date.now() + expiresIn * 1000)); } catch {}
    }
  });
}

