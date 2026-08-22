import { Link } from "react-router-dom";

// The wordmark, set as the supplied logo sets it: a charcoal plate, amber
// "Un", off-white "paque", an amber rule beneath, and the tagline in widely
// tracked capitals.
//
// It is drawn in type rather than dropped in as an image so it stays sharp at
// any size, adapts to a light-mode reader, and can be read by a screen reader
// as the word it is.

const FEATURES = [
  {
    to: "/unpack",
    name: "Unpack",
    line: "Communication diagnostics",
    blurb:
      "Grammarly asks whether this is written correctly. Unpack asks whether it is communicating the way you think it is.",
  },
  {
    to: "/research",
    name: "The Researcher",
    line: "Literature, verified",
    blurb:
      "Every reference comes from a bibliographic provider and its identifier is re-checked before you see it. None of them come from a language model.",
  },
  {
    to: "/cases",
    name: "The Detective",
    line: "Investigative intelligence",
    blurb:
      "What does the available evidence actually allow us to say? What remains unknown? What does not fit?",
  },
];

export default function Landing() {
  return (
    <div>
      <section
        aria-label="Unpaque"
        className="rounded-2xl bg-[rgb(28_26_23)] px-6 py-20 text-center sm:py-28"
      >
        <h1 className="text-6xl font-bold tracking-tight sm:text-7xl">
          <span className="text-[rgb(217_160_60)]">Un</span>
          <span className="text-[rgb(242_239_233)]">paque</span>
        </h1>
        <div aria-hidden className="mx-auto mt-6 h-0.5 w-40 bg-[rgb(217_160_60)]" />
        <p className="mt-6 text-sm font-medium uppercase tracking-[0.3em] text-[rgb(138_133_128)]">
          Communication diagnostics
        </p>
      </section>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <Link
            key={feature.to}
            to={feature.to}
            className="rounded-lg border border-rule bg-raised p-5 transition-colors hover:border-accent"
          >
            <h3 className="font-bold">{feature.name}</h3>
            <p className="mt-0.5 text-xs uppercase tracking-wider text-accent">{feature.line}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{feature.blurb}</p>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-sm leading-relaxed text-muted">
        Three tools that share one discipline: they describe what is there, name where it came
        from, and say plainly what they do not know.
      </p>
    </div>
  );
}
