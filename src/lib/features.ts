// The three features, in one place.
//
// Named here rather than in either component because they are now rendered
// twice — inside the landing plate, and in the shell on every other route —
// and two lists that must agree is one list waiting to disagree.
//
// The names are verbs, and deliberately parallel: Unpack, Research, Detect.
// The Detective specification calls them "Unpack", "The Researcher" and "The
// Detective" (§0), and personified names were the obvious alternative — they
// read warmly and they were what the client wrote. They were dropped because
// only one of the three could carry a person: "Unpack" refused to become "The
// Unpacker", which left one imperative sitting beside two characters, and a
// tab bar that mixes the two forms reads as three unrelated products rather
// than one tool used three ways. `short` carries the noun the name gives up.
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
    name: "Research",
    line: "Literature, verified",
    short: "literature",
    blurb:
      "Every reference comes from a bibliographic provider and its identifier is re-checked before you see it. None of them come from a language model.",
  },
  {
    // Not /detect. The page is a list of cases and the one below it is a
    // single case, so /cases and /cases/:id name what is actually there;
    // renaming the route to match the tab would leave /detect/:id meaning
    // "a detect", which is not a thing.
    to: "/cases",
    name: "Detect",
    line: "Investigative intelligence",
    short: "investigations",
    blurb:
      "What does the available evidence actually allow us to say? What remains unknown? What does not fit?",
  },
] as const;
