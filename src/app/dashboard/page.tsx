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
  Activity,
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
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

const metricsByTimeframe = {
  weekly: [
    { label: "Sat", mood: 6.2, sleep: 7.5, health: 5.4 },
    { label: "Sun", mood: 7.4, sleep: 8, health: 6.1 },
    { label: "Mon", mood: 5.1, sleep: 6.2, health: 5 },
    { label: "Tue", mood: 6.3, sleep: 7, health: 5.6 },
    { label: "Wed", mood: 4.8, sleep: 5.8, health: 4.9 },
    { label: "Thu", mood: 5.7, sleep: 6.4, health: 5.2 },
    { label: "Fri", mood: 6.9, sleep: 7.2, health: 5.9 },
  ],
  monthly: [
    { label: "Week 1", mood: 6.8, sleep: 7.1, health: 5.8 },
    { label: "Week 2", mood: 7.2, sleep: 7.6, health: 6.2 },
    { label: "Week 3", mood: 6.3, sleep: 6.9, health: 5.6 },
    { label: "Week 4", mood: 7.1, sleep: 7.4, health: 6.1 },
  ],
} as const;

const statCards = [
  {
    title: "Mood Score",
    value: "7.2/10",
    delta: "+0.4",
    helper: "vs last week",
    trend: "up" as const,
    icon: HeartPulse,
    accent: "from-sky-500/80 via-blue-500/30",
  },
  {
    title: "Sleep Quality",
    value: "74%",
    delta: "+12%",
    helper: "7h goal",
    trend: "up" as const,
    icon: Clock,
    accent: "from-indigo-500/80 via-indigo-500/30",
  },
  {
    title: "AI Sessions",
    value: "2",
    delta: "-1",
    helper: "vs target",
    trend: "down" as const,
    icon: MessageCircle,
    accent: "from-fuchsia-500/80 via-purple-500/30",
  },
  {
    title: "Community Touches",
    value: "0",
    delta: "0",
    helper: "posts this week",
    trend: "flat" as const,
    icon: Users,
    accent: "from-emerald-500/80 via-emerald-500/30",
  },
];

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

const focusTasks = [
  {
    id: "breathing",
    title: "3-min breathing reset",
    detail: "Guided by AI Companion",
  },
  {
    id: "gratitude",
    title: "Log a gratitude note",
    detail: "Boosts mood awareness",
  },
  {
    id: "stretch",
    title: "Mindful stretch",
    detail: "Release tension before bed",
  },
];

const moodOptions = [
  { label: "Excellent", value: "excellent", emoji: "🌞" },
  { label: "Good", value: "good", emoji: "😊" },
  { label: "Okay", value: "okay", emoji: "🙂" },
  { label: "Bad", value: "bad", emoji: "😕" },
  { label: "Awful", value: "awful", emoji: "😞" },
];

const healthIndicators = [
  { label: "Energy", value: 42, color: "bg-blue-400" },
  { label: "Focus", value: 58, color: "bg-indigo-400" },
  { label: "Stress", value: 31, color: "bg-emerald-400" },
];

const upcomingSessions = [
  { label: "Mindfulness class", time: "Today • 6:00 PM", type: "Community" },
  { label: "Therapist session", time: "Tue • 11:30 AM", type: "Virtual" },
  { label: "AI check-in", time: "Thu • 9:00 PM", type: "Auto" },
];

const timeframeOptions: Array<keyof typeof metricsByTimeframe> = [
  "weekly",
  "monthly",
];

function classNames(...values: Array<string | undefined | null | false>) {
  return values.filter(Boolean).join(" ");
}

export default function DashboardPage() {
  const [selectedMood, setSelectedMood] = useState<string>("okay");
  const [timeframe, setTimeframe] = useState<keyof typeof metricsByTimeframe>(
    "weekly",
  );
  const [journalEntry, setJournalEntry] = useState("");
  const [entries, setEntries] = useState<string[]>([]);
  const [journalSaved, setJournalSaved] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);

  const chartSeries = useMemo(
    () => metricsByTimeframe[timeframe].map((point) => ({ ...point })),
    [timeframe],
  );

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

  const handleSaveEntry = () => {
    const trimmed = journalEntry.trim();
    if (!trimmed) return;
    setEntries((prev) => [trimmed, ...prev.slice(0, 3)]);
    setJournalEntry("");
    setJournalSaved(true);
  };

  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const currentMood = moodOptions.find((m) => m.value === selectedMood)?.label;
  const lastJournal = entries.length > 0 ? "Today" : "None yet";

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
                Welcome back, Moses R!
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
                value="0 days"
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
              {upcomingSessions.map((session) => (
                <li
                  key={session.label}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-200">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div className="space-y-1">
                    <p className="font-medium text-white">{session.label}</p>
                    <p className="text-xs text-slate-300">{session.time}</p>
                    <span className="inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-200">
                      {session.type}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-3xl border border-white/5 bg-gradient-to-br from-indigo-500/20 via-indigo-500/10 to-transparent p-6 shadow-xl shadow-indigo-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">
                  Quote of the Day
                </p>
                <p className="mt-3 text-base text-indigo-50">
                  &ldquo;Balance is not perfection, it&apos;s about progress.&rdquo;
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/20 bg-white/10 p-2 text-indigo-100 transition hover:border-white/40"
                aria-label="Refresh quote"
              >
                <RefreshCw className="h-4 w-4" />
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
        </article>

        <article className="rounded-3xl border border-white/5 bg-slate-900/70 p-8 shadow-xl shadow-indigo-500/10 backdrop-blur-xl">
          <header>
            <h2 className="text-lg font-semibold text-white">Mood pulse</h2>
            <p className="mt-1 text-sm text-slate-400">
              Choose the option that feels closest right now.
            </p>
          </header>
          <div className="mt-6 grid gap-3">
            {moodOptions.map((mood) => {
              const isActive = selectedMood === mood.value;
              return (
                <button
                  key={mood.value}
                  type="button"
                  onClick={() => setSelectedMood(mood.value)}
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
          <p className="mt-5 text-sm text-slate-300">{moodHeadline}</p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            <h3 className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Suggested next step
            </h3>
            <p className="mt-3 text-slate-200">
              Try a guided breath from the AI Companion or write a quick thought
              in the journal to capture the moment.
            </p>
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
          <textarea
            value={journalEntry}
            onChange={(event) => setJournalEntry(event.target.value)}
            placeholder="Write down your thoughts and feelings..."
            className="mt-6 h-32 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/30"
          />
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
                {entries.map((entry, index) => (
                  <li
                    key={index}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200"
                  >
                    {entry}
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
                <p className="mt-1 text-sm text-slate-400">
                  Pick small resets to keep your streak alive.
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
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

          <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-8 shadow-xl shadow-indigo-500/10 backdrop-blur-xl">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Core vitals</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Snapshot from your latest check-ins.
                </p>
              </div>
              <Activity className="h-5 w-5 text-emerald-300" />
            </header>
            <ul className="mt-6 space-y-4 text-sm text-slate-200">
              {healthIndicators.map((indicator) => (
                <li key={indicator.label}>
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-slate-400">
                    <span>{indicator.label}</span>
                    <span>{indicator.value}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={classNames("h-full rounded-full", indicator.color)}
                      style={{ width: `${indicator.value}%` }}
                    />
                  </div>
                </li>
              ))}
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
