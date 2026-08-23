// Spoken and typed commands, over a closed vocabulary.
//
// Section 24, and section 28 of the build document, whose most important line
// is this: "The Detective should answer by navigating the dossier, not merely
// generating text."
//
// That is what makes this buildable with no model at all. "Open source
// fourteen", "show the timeline", "what remains unknown" are navigation over
// structured records, not questions needing a language model — and a
// deterministic parser over a closed grammar is better here than a model would
// be, because the failure modes are opposite. A model asked to interpret
// "source forty" against a case with fourteen sources will pick one. This
// refuses, and says what it heard.
//
// **Nothing here generates an answer.** The commands move to a record; the
// screen shows what the record says. The moment a command produces a sentence
// nobody wrote is the moment an investigative tool starts making things up
// with a voice interface's authority behind it.
//
// Speech recognition is the browser's own, which is why this module takes a
// string: what it parses is the same whether it was spoken or typed, and the
// typed path is what makes it testable and what works in a browser with no
// recogniser.

export type Command =
  | { kind: "show_panel"; panel: "claims" | "sources" | "timeline" | "explanations" }
  | { kind: "open_source"; reference: number }
  | { kind: "open_evidence"; reference: number }
  | { kind: "compare_sources"; first: number; second: number }
  | { kind: "what_is_unknown" }
  | { kind: "stop" };

export interface Refusal {
  kind: "not_understood" | "not_built";
  /** What was heard, verbatim. Shown so a mishearing is visible. */
  heard: string;
  says: string;
}

export type Interpretation = { kind: "command"; command: Command } | Refusal;

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

/**
 * A number, spoken or written.
 *
 * Handles "fourteen", "forty two", "forty-two" and "14". Deliberately not
 * hundreds and above: a case with more than ninety-nine sources exists, and
 * somebody reading one out will say the digits, which the first branch
 * already takes.
 */
export function spokenNumber(words: string): number | null {
  const text = words.trim().toLowerCase().replace(/-/g, " ");
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts.length > 2) return null;

  if (parts.length === 1) {
    const single = parts[0]!;
    return ONES[single] ?? TENS[single] ?? null;
  }
  const tens = TENS[parts[0]!];
  const ones = ONES[parts[1]!];
  if (tens === undefined || ones === undefined || ones > 9) return null;
  return tens + ones;
}

/** Filler a spoken command arrives wrapped in. */
const LEADING = /^(?:please\s+|now\s+|ok(?:ay)?\s+|detective[,]?\s+|can you\s+|could you\s+)+/;

function tidy(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING, "")
    .trim();
}

/**
 * What a phrase means, or why it does not mean anything.
 *
 * A closed grammar, matched in order. There is no fuzzy fallback: an
 * unrecognised phrase is refused with what was heard beside it, because the
 * commonest failure of a voice interface is not mishearing — it is
 * mishearing and acting anyway, leaving the operator to work out from the
 * screen what it thought they said.
 */
export function interpret(phrase: string): Interpretation {
  const text = tidy(phrase);
  if (text === "") {
    return { kind: "not_understood", heard: phrase, says: "Nothing was heard." };
  }

  const command = (found: Command): Interpretation => ({ kind: "command", command: found });

  if (/^(stop|pause|halt|wait)$/.test(text)) return command({ kind: "stop" });

  // Specified, and there is nothing to play. Refused with the reason rather
  // than ignored: a command that silently does nothing reads as a mishearing,
  // and the operator says it again, louder.
  if (/\b(play|resume|rewind|skip|scrub|seek)\b/.test(text)) {
    return {
      kind: "not_built",
      heard: phrase,
      says: "There is no media to play. Video, audio and transcripts are not built, so nothing in this case can be played from a timestamp.",
    };
  }
  if (/\b(transcript|subtitles|captions)\b/.test(text)) {
    return {
      kind: "not_built",
      heard: phrase,
      says: "There are no transcripts. Transcription is not built.",
    };
  }
  if (/\b(photograph|photo|video|footage|recording|audio)\b/.test(text)) {
    return {
      kind: "not_built",
      heard: phrase,
      says: "There is no media in this case. Sources are records, not files.",
    };
  }

  const compare = /^compare\s+sources?\s+(.+?)\s+(?:and|with|to)\s+(.+)$/.exec(text);
  if (compare) {
    const first = spokenNumber(compare[1]!);
    const second = spokenNumber(compare[2]!);
    if (first !== null && second !== null && first !== second) {
      return command({ kind: "compare_sources", first, second });
    }
    return {
      kind: "not_understood",
      heard: phrase,
      says: "Two different source numbers are needed to compare them.",
    };
  }

  const source = /^(?:open|show|go to|bring up)\s+(?:the\s+)?source\s+(.+)$/.exec(text);
  if (source) {
    const reference = spokenNumber(source[1]!);
    if (reference !== null) return command({ kind: "open_source", reference });
    return {
      kind: "not_understood",
      heard: phrase,
      says: `No source number was recognised in that. Say a number, as in "open source fourteen".`,
    };
  }

  const evidence = /^(?:open|show|go to|bring up)\s+(?:the\s+)?evidence\s+(.+)$/.exec(text);
  if (evidence) {
    const reference = spokenNumber(evidence[1]!);
    if (reference !== null) return command({ kind: "open_evidence", reference });
  }

  if (/\b(what (?:remains|is still) unknown|what don'?t we know|what is missing)\b/.test(text)) {
    return command({ kind: "what_is_unknown" });
  }

  // Panels last, because "show source fourteen" must not be caught by "source".
  if (/\b(claims?|allegations?)\b/.test(text)) return command({ kind: "show_panel", panel: "claims" });
  if (/\b(sources?|the record|the register)\b/.test(text)) {
    return command({ kind: "show_panel", panel: "sources" });
  }
  if (/\b(timeline|chronology|sequence)\b/.test(text)) {
    return command({ kind: "show_panel", panel: "timeline" });
  }
  if (/\b(explanations?|hypothes[ei]s|theor(?:y|ies))\b/.test(text)) {
    return command({ kind: "show_panel", panel: "explanations" });
  }

  return {
    kind: "not_understood",
    heard: phrase,
    says: "That is not a command this understands. It navigates the case file; it does not answer questions in its own words.",
  };
}

/** The commands worth printing on screen, because a closed grammar has to be discoverable. */
export const EXAMPLE_COMMANDS = [
  "Show the claims",
  "Open source fourteen",
  "Compare sources three and nine",
  "Show the timeline",
  "What remains unknown",
  "Stop",
] as const;
