import { Link } from "react-router-dom";
import { FEATURES } from "@/lib/features.ts";

// The wordmark set as the supplied logo sets it — charcoal plate, amber "Un",
// off-white "paque", amber rule, tagline in widely tracked capitals — with the
// three features sitting directly beneath the tagline, inside the plate.
//
// Drawn in type rather than dropped in as an image so it stays sharp at any
// size, adapts to a light-mode reader, and reads as the word it is to anything
// that cannot see it.

export default function Landing() {
  return (
    <div>
      <section
        aria-label="Unpaque"
        className="rounded-2xl bg-[rgb(28_26_23)] px-6 py-16 text-center sm:py-20"
      >
        <h1 className="text-6xl font-bold tracking-tight sm:text-7xl">
          <span className="text-[rgb(217_160_60)]">Un</span>
          <span className="text-[rgb(242_239_233)]">paque</span>
        </h1>
        <div aria-hidden className="mx-auto mt-6 h-0.5 w-40 bg-[rgb(217_160_60)]" />
        <p className="mt-6 text-sm font-medium uppercase tracking-[0.3em] text-[rgb(138_133_128)]">
          Communication diagnostics
        </p>

        {/* On the plate, beneath the tagline. The colours are literal rather
            than token-driven here: the plate is the brand's own charcoal in
            both themes, so tokens that flip for a light-mode reader would put
            off-white text on off-white. */}
        <nav className="mt-10 flex flex-wrap justify-center gap-3" aria-label="Features">
          {FEATURES.map((feature) => (
            <Link
              key={feature.to}
              to={feature.to}
              className="rounded-lg border border-[rgb(217_160_60)]/40 px-5 py-2.5 text-left transition-colors hover:border-[rgb(217_160_60)] hover:bg-[rgb(217_160_60)]/10"
            >
              <span className="block font-medium text-[rgb(242_239_233)]">{feature.name}</span>{" "}
              {/* The space is for the accessible name, not the layout: both
                  spans are block-level, so it collapses to nothing on screen,
                  and without it a screen reader announces the link as
                  "Unpackdiagnostics". */}
              <span className="block text-xs uppercase tracking-wider text-[rgb(217_160_60)]">
                {feature.short}
              </span>
            </Link>
          ))}
        </nav>
      </section>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.to} className="rounded-lg border border-rule bg-raised p-5">
            <h2 className="font-bold">{feature.name}</h2>
            <p className="mt-0.5 text-xs uppercase tracking-wider text-accent">{feature.line}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{feature.blurb}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-sm leading-relaxed text-muted">
        Three tools that share one discipline: they describe what is there, name where it came
        from, and say plainly what they do not know.
      </p>
    </div>
  );
}
