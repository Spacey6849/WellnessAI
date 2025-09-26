const highlights = [
  {
    title: "Daily Gratitude Thread",
    description: "Share one thing that made you smile today.",
  },
  {
    title: "Anonymous Vent Space",
    description: "Let it out in a supportive, judgement-free zone.",
  },
  {
    title: "Peer Mentor Requests",
    description: "Connect with others walking a similar path.",
  },
];

export default function CommunityPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-16">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-xl shadow-purple-500/10 backdrop-blur-xl">
        <h1 className="text-3xl font-semibold text-white">Community Hub</h1>
        <p className="mt-4 max-w-3xl text-base text-slate-300">
          Anonymous sharing, uplifting stories, and group challenges will live
          here. Integrate Supabase Realtime to keep updates flowing instantly.
        </p>
      </section>
      <section className="grid gap-6 md:grid-cols-3">
        {highlights.map((item) => (
          <article
            key={item.title}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200"
          >
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-3">{item.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
