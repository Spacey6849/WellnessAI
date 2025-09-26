"use client";

import { useState, useMemo } from "react";
import { wellnessResources, wellnessMetaSummary, type WellnessVideoResource } from "../../data/wellnessResources";

// Extract YouTube ID helper
const extractYouTubeId = (url: string) => {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
  } catch {}
  return null;
};

export default function ResourcesPage() {
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const active = useMemo(() => wellnessResources.find((r: WellnessVideoResource) => r.topic === activeTopic), [activeTopic]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 pb-24">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-xl shadow-emerald-500/10 backdrop-blur-xl">
        <h1 className="text-3xl font-semibold text-white tracking-tight">Resource Library</h1>
        <p className="mt-4 max-w-3xl text-base text-slate-300">
          Explore evidence‑informed mental wellness videos. Select a topic to watch directly without leaving the experience.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
          <span>Total Videos: <span className="text-slate-200">{wellnessMetaSummary.totalVideos}</span></span>
          <span>Avg Duration: <span className="text-slate-200">{wellnessMetaSummary.avgDurationMinutes}m</span></span>
        </div>
      </section>

      {active && (
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-6 md:p-8 relative">
          <div className="flex flex-col gap-6">
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
              {(() => {
                const id = extractYouTubeId(active.url);
                return id ? (
                  <iframe
                    key={id}
                    title={active.youtubeTitle}
                    src={`https://www.youtube.com/embed/${id}?rel=0`}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">Invalid video link</div>
                );
              })()}
            </div>
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-white">{active.topic}</h2>
              <p className="text-sm text-slate-300 leading-relaxed">{active.summary}</p>
              <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-400">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{active.category}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{active.videoType}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{active.duration}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{active.channel}</span>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-300">
                {active.keyTakeaways.map((k: string) => <li key={k}>{k}</li>)}
              </ul>
              <p className="mt-2 text-xs text-emerald-300/90">Use: {active.recommendedUse}</p>
              <button
                onClick={() => setActiveTopic(null)}
                className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/25 hover:bg-white/10"
                aria-label="Close video player"
              >Close</button>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-5 text-lg font-semibold uppercase tracking-[0.35em] text-slate-400">Browse Topics</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {wellnessResources.map((r: WellnessVideoResource) => {
            const id = extractYouTubeId(r.url);
            return (
              <button
                key={r.topic}
                onClick={() => setActiveTopic(r.topic)}
                className={`group relative flex flex-col rounded-3xl border border-white/10 bg-white/5 p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 hover:border-white/25 hover:bg-white/10 ${activeTopic === r.topic ? "ring-2 ring-blue-500/40" : ""}`}
                aria-pressed={activeTopic === r.topic}
                aria-label={`Open video for ${r.topic}`}
              >
                <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black/60 mb-4">
                  {id ? (
                    <iframe
                      title={r.youtubeTitle}
                      src={`https://www.youtube.com/embed/${id}?rel=0&mute=1`}
                      className="h-full w-full pointer-events-none opacity-80 group-hover:opacity-100 transition"
                      tabIndex={-1}
                      aria-hidden
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-slate-500">No preview</div>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug">{r.topic}</h3>
                <p className="mt-2 text-xs text-slate-300 line-clamp-3">{r.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-400">
                  <span>{r.category}</span>
                  <span>{r.videoType}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-white">Usage Plan (Sample Week)</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-300">
          {wellnessMetaSummary.shortUsagePlan.map((step: string) => <li key={step}>{step}</li>)}
        </ol>
        <p className="mt-6 text-xs text-slate-400">{wellnessMetaSummary.disclaimer}</p>
      </section>
    </div>
  );
}
