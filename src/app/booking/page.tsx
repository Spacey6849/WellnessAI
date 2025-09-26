"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  HeartPulse,
  MapPin,
  ShieldCheck,
  UserCheck,
  Video,
  PhoneCall,
} from "lucide-react";

const therapists = [
  {
    id: "avery-jones",
    name: "Dr. Avery Jones",
    focus: "Anxiety & Burnout",
    bio: "Trauma-informed CBT specialist supporting young professionals.",
    location: "Virtual • New York",
    formats: ["Video", "Audio"],
    languages: "English",
    expertise: ["CBT", "Mindfulness", "Somatic work"],
    rating: 4.9,
  },
  {
    id: "maya-rahman",
    name: "Maya Rahman, LCSW",
    focus: "Stress & Life Transitions",
    bio: "Holistic therapist blending talk therapy with grounding practices.",
    location: "Hybrid • Toronto",
    formats: ["Video", "In-person"],
    languages: "English, Bengali",
    expertise: ["Acceptance therapy", "Breathwork", "Family systems"],
    rating: 4.8,
  },
  {
    id: "liam-ng",
    name: "Liam Ng, PsyD",
    focus: "Mood & Sleep regulation",
    bio: "Blends behavioral sleep therapy with gentle accountability coaching.",
    location: "Virtual • San Francisco",
    formats: ["Video"],
    languages: "English, Mandarin",
    expertise: ["Sleep retraining", "EMDR", "Lifestyle planning"],
    rating: 4.7,
  },
];

const sessionTypes = [
  { label: "Video session", icon: Video },
  { label: "Phone call", icon: PhoneCall },
  { label: "In-person", icon: MapPin },
];

type AvailabilityMap = Record<TherapistId, Record<string, string[]>>;

const availability: AvailabilityMap = {
  "avery-jones": {
    "2025-09-26": ["09:30", "11:00", "14:30"],
    "2025-09-27": ["10:00", "13:30"],
    "2025-09-29": ["08:30", "12:00", "17:30"],
  },
  "maya-rahman": {
    "2025-09-26": ["08:30", "16:00"],
    "2025-09-28": ["09:30", "12:30", "18:30"],
    "2025-09-30": ["10:00", "11:30", "15:00"],
  },
  "liam-ng": {
    "2025-09-26": ["07:30", "09:00"],
    "2025-09-27": ["11:30", "15:30"],
    "2025-09-29": ["13:00", "19:00"],
  },
};

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

type TherapistId = (typeof therapists)[number]["id"];

function formatDateKey(dateKey: string) {
  return new Date(dateKey).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function BookingPage() {
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistId>(
    therapists[0].id,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState(sessionTypes[0].label);
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const therapist = useMemo(
    () => therapists.find((item) => item.id === selectedTherapist)!,
    [selectedTherapist],
  );

  const therapistAvailability = availability[selectedTherapist];
  const upcomingDates = useMemo(
    () => Object.keys(therapistAvailability ?? {}),
    [therapistAvailability],
  );

  const canSubmit = Boolean(selectedDate && selectedSlot && email.trim());

  // Derive a simple current step indicator for the progress bar
  // 1 = therapist/session type selection, 2 = date & slot selection, 3 = context & confirmation
  const currentStep = selectedSlot ? 3 : selectedDate ? 2 : 1;

  const submitBooking = () => {
    if (!canSubmit) return;
    setIsSubmitted(true);
    setTimeout(() => setIsSubmitted(false), 4000);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 pb-24">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <article className="relative overflow-hidden rounded-4xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/85 to-slate-950 p-12 text-white shadow-2xl shadow-blue-500/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.2),transparent_65%)]" />
          <div className="relative z-10 flex flex-col gap-8">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-500/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-blue-100">
              <ShieldCheck size={14} /> Therapy network
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                Book a therapist who understands your rhythm.
              </h1>
              <p className="max-w-2xl text-base text-slate-100/90">
                Discover curated professionals aligned with your mood trends.
                Choose a slot, leave context, and you&apos;re set &mdash; your
                support team will confirm within minutes.
              </p>
            </div>
            {/* Progress indicator */}
            <div aria-label="Booking progress" className="mt-2 flex items-center gap-3" role="list">
              {[1, 2, 3].map((step) => {
                const active = step <= currentStep;
                return (
                  <div
                    key={step}
                    role="listitem"
                    className={`flex flex-1 items-center gap-3 text-xs font-semibold tracking-[0.3em] transition ${
                      active ? "text-blue-100" : "text-slate-500"
                    }`}
                  >
                    <span
                      aria-current={active && step === currentStep ? "step" : undefined}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-[11px] transition ${
                        active
                          ? "border-blue-400/60 bg-blue-500/25 text-white shadow-[0_0_0_3px_rgba(59,130,246,0.25)]"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      {step}
                    </span>
                    {step < 3 && (
                      <span
                        className={`h-0.5 flex-1 rounded-full transition ${
                          currentStep > step ? "bg-blue-400/70" : "bg-white/10"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {infoBullets.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-100"
                >
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-slate-200/80">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </article>

        <aside className="flex flex-col gap-5">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <header className="flex items-center gap-3 text-white">
              <HeartPulse className="h-5 w-5 text-emerald-300" />
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">
                  Personalized
                </p>
                <h2 className="text-lg font-semibold">Suggested matches</h2>
              </div>
            </header>
            <ul className="mt-5 space-y-4 text-sm text-slate-200">
              {therapists.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <p className="text-sm font-semibold text-white">{item.name}</p>
                  <p className="text-xs text-slate-300">{item.focus}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {item.bio}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-6 text-sm text-slate-200 shadow-lg shadow-emerald-500/10">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">
              Need help choosing?
            </p>
            <p className="mt-2 text-base text-white">
              Start a quick AI chat to craft the right note for your therapist or
              surface additional recommendations.
            </p>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-100"
            >
              Launch companion <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </aside>
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <article className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-xl shadow-indigo-500/15 backdrop-blur-xl">
          <header className="flex flex-col gap-2 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Plan your session</h2>
              <p className="text-sm text-slate-300">
                Choose your therapist, pick a time, and leave any context.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-slate-200">
              <CalendarClock className="h-4 w-4" /> Slots auto-sync to your dashboard
            </div>
          </header>

          <div className="mt-8 grid gap-8">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  Step 1
                </p>
                <h3 className="text-lg font-semibold text-white">Select a therapist</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {therapists.map((item) => {
                    const active = selectedTherapist === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          setSelectedTherapist(item.id);
                          setSelectedDate(null);
                          setSelectedSlot(null);
                        }}
                        aria-pressed={active}
                        aria-label={`Select therapist ${item.name}`}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                          active
                            ? "border-blue-500/70 bg-blue-500/20 text-white shadow-lg shadow-blue-500/25"
                            : "border-white/10 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {item.name}
                            </p>
                            <p className="text-xs text-slate-300">{item.focus}</p>
                          </div>
                          <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-blue-200">
                            {item.rating.toFixed(1)} ★
                          </span>
                        </div>
                        <p className="mt-3 text-xs text-slate-300">{item.bio}</p>
                        <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-300">
                          <span className="rounded-full border border-white/20 px-2 py-0.5">
                            {item.location}
                          </span>
                          <span className="rounded-full border border-white/20 px-2 py-0.5">
                            {item.languages}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  Formats
                </p>
                <p className="text-sm font-semibold text-white">Session type</p>
                <div className="grid gap-3">
                  {sessionTypes.map(({ label, icon: Icon }) => {
                    const active = sessionType === label;
                    const disabled = !therapist.formats.some((format) =>
                      label.toLowerCase().includes(format.toLowerCase()),
                    );
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => !disabled && setSessionType(label)}
                        aria-pressed={active}
                        aria-disabled={disabled}
                        aria-label={`${label} session type${disabled ? " not available for this therapist" : active ? " selected" : ""}`}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                          disabled
                            ? "cursor-not-allowed border-white/5 opacity-40"
                            : active
                              ? "border-emerald-500/70 bg-emerald-500/15 text-white"
                              : "border-white/10 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10"
                        }`}
                      >
                        <span className="flex items-center gap-3 text-sm">
                          <Icon className="h-4 w-4" /> {label}
                        </span>
                        {active && <CheckCircle2 className="h-4 w-4 text-emerald-200" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  Step 2
                </p>
                <h3 className="text-lg font-semibold text-white">Pick a time</h3>
                {upcomingDates.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
                    <AlertCircle className="mb-3 h-5 w-5 text-amber-300" />
                    Slots will appear here once this therapist syncs their
                    availability.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {upcomingDates.map((date) => {
                      const active = selectedDate === date;
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => {
                            setSelectedDate(date);
                            setSelectedSlot(null);
                          }}
                          aria-pressed={active}
                          aria-label={`Select date ${formatDateKey(date)}`}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            active
                              ? "border-blue-500/70 bg-blue-500/20 text-white"
                              : "border-white/10 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10"
                          }`}
                        >
                          <p className="text-sm font-semibold text-white">
                            {formatDateKey(date)}
                          </p>
                          <p className="mt-1 text-xs text-slate-300">
                            {availability[selectedTherapist][date].length} slots
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedDate && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200">
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                      Available slots
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {availability[selectedTherapist][selectedDate].map((slot: string) => {
                        const active = selectedSlot === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            aria-pressed={active}
                            aria-label={`Select time slot ${slot}`}
                            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                              active
                                ? "bg-white text-slate-900"
                                : "border border-white/15 bg-transparent text-slate-200 hover:border-white/30"
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <form
                className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200"
                aria-labelledby="share-context-heading"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitBooking();
                }}
              >
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  Step 3
                </p>
                <h3 id="share-context-heading" className="text-lg font-semibold text-white">
                  Share context
                </h3>
                <label htmlFor="contact-email" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                  Contact email
                </label>
                <input
                  id="contact-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/30"
                />
                <label htmlFor="notes" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                  Notes for your therapist
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Share anything you want them to know before the session..."
                  className="h-28 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/30"
                />
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40 ${
                    canSubmit
                      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400 active:translate-y-px"
                      : "cursor-not-allowed border border-white/10 bg-white/5 text-slate-400"
                  }`}
                >
                  Confirm appointment
                </button>
                {isSubmitted && (
                  <div
                    aria-live="polite"
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Request received — we&apos;ll email you shortly.
                  </div>
                )}
              </form>
            </div>
          </div>
        </article>

        <aside className="space-y-6">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-300">
              About your therapist
            </h3>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200">
              <header className="flex items-start justify-between">
                <div>
                  <p className="text-base font-semibold text-white">
                    {therapist.name}
                  </p>
                  <p className="text-xs text-slate-300">{therapist.focus}</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-blue-200">
                  {sessionType}
                </span>
              </header>
              <p className="mt-3 text-xs text-slate-300">{therapist.bio}</p>
              <div className="mt-4 space-y-2 text-xs text-slate-300">
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-200" /> {therapist.location}
                </p>
                <p className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-blue-200" /> Languages: {therapist.languages}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-200">
                {therapist.expertise.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent p-6 text-sm text-slate-200 shadow-lg shadow-blue-500/10">
            <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-200">
              What happens next?
            </h3>
            <ol className="mt-4 space-y-3 text-slate-200">
              <li className="flex items-start gap-3">
                <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-semibold">
                  1
                </span>
                We send your request and supporting notes to your therapist.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-semibold">
                  2
                </span>
                They confirm the slot or suggest alternatives if needed.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-semibold">
                  3
                </span>
                A calendar invite plus prep checklist appears in your dashboard.
              </li>
            </ol>
          </article>
        </aside>
      </section>
    </div>
  );
}
