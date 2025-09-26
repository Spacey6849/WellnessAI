export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 pb-24">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/70 p-10 shadow-2xl shadow-blue-500/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
        <div className="space-y-8 text-center md:text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-4 py-1 text-sm font-medium text-blue-400">
            AI-Driven Support • Private & Secure
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 md:text-5xl">
            Personalized mental wellness guidance, whenever you need it.
          </h1>
          <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300 md:text-lg">
            WellnessAI combines daily mood tracking, smart interventions, and
            human connection to keep you supported between therapy sessions.
            Discover actionable insights tailored to your unique wellness
            journey.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <a
              href="/signup"
              className="btn btn-primary w-full sm:w-auto"
            >
              Start free assessment
            </a>
            <a
              href="/resources"
              className="btn btn-outline w-full sm:w-auto"
            >
              Explore resources
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Daily Mood Studio",
            description:
              "Check in with adaptive prompts that adjust to your patterns and highlight early warning signs.",
          },
          {
            title: "Care Pathways",
            description:
              "Book verified therapists, escalate to crisis care, and stay connected with your support circle.",
          },
          {
            title: "AI Insights",
            description:
              "Receive curated practices, micro-habits, and educational content aligned with your emotional trends.",
          },
        ].map((feature) => (
          <article
            key={feature.title}
            className="rounded-3xl border border-white/10 bg-white/70 p-6 shadow-xl shadow-indigo-500/10 backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-2xl dark:bg-slate-900/70"
          >
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
              {feature.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {feature.description}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
