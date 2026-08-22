// The three features, in one place.
//
// Named here rather than in either component because they are now rendered
// twice — inside the landing plate, and in the shell on every other route —
// and two lists that must agree is one list waiting to disagree.
export const FEATURES = [
  {
    to: "/unpack",
    name: "Unpack",
    line: "Communication diagnostics",
    short: "diagnostics",
    blurb:
      "Grammarly asks whether this is written correctly. Unpack asks whether it is communicating the way you think it is.",
  },
  {
    to: "/research",
    name: "The Researcher",
    line: "Literature, verified",
    short: "literature",
    blurb:
      "Every reference comes from a bibliographic provider and its identifier is re-checked before you see it. None of them come from a language model.",
  },
  {
    to: "/cases",
    name: "The Detective",
    line: "Investigative intelligence",
    short: "investigations",
    blurb:
      "What does the available evidence actually allow us to say? What remains unknown? What does not fit?",
  },
] as const;
