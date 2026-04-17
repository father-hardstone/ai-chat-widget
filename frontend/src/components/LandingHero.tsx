export function LandingHero() {
  return (
    <section
      className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6 py-16 text-center"
      aria-label="XYZ Apparel hero"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(34,211,238,0.18),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(9,9,11,0.85))]"
        aria-hidden
      />

      <div className="relative z-10 max-w-2xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-cyan-400/90">
          XYZ Apparel
        </p>
        <h1 className="text-balance font-serif text-4xl font-medium tracking-tight text-white sm:text-5xl md:text-6xl">
          Style that fits your day.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
          Casual, formal, and seasonal wear for the whole family—discover pieces you&apos;ll reach for
          again and again.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-100 backdrop-blur-sm">
            New arrivals in store
          </span>
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-5 py-2.5 text-sm font-medium text-cyan-200">
            Sizes XS–XXL
          </span>
        </div>
      </div>
    </section>
  )
}
