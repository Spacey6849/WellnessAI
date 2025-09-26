const featuredResources = [
  {
    title: "Grounding Exercises",
    description: "Quick sensory resets for anxious moments.",
  },
  {
    title: "Sleep Hygiene Toolkit",
    description: "Night routines and evidence-based practices.",
  },
  {
    title: "Mindfulness Micro-habits",
    description: "Five-minute shifts to recenter your focus.",
  },
];

export default function ResourcesPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-16">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-xl shadow-emerald-500/10 backdrop-blur-xl">
        <h1 className="text-3xl font-semibold text-white">Resource Library</h1>
        <p className="mt-4 max-w-3xl text-base text-slate-300">
          Personalized content recommendations will appear here as soon as mood
          trends and goals are connected. Until then, explore a few curated
          ideas for daily practice.
        </p>
      </section>
      <section className="grid gap-6 md:grid-cols-3">
        {featuredResources.map((resource) => (
          <article
            key={resource.title}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200"
          >
            <h2 className="text-lg font-semibold text-white">{resource.title}</h2>
            <p className="mt-3">{resource.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
