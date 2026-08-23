// Units of analysis, which agreement cannot be computed without.
//
// This module exists because of a mistake that is easy to make and produces a
// confident number that means nothing. Cohen's kappa compares two raters
// assigning categories to *the same set of units*. Qualitative coders do not
// work that way: each one chooses their own spans, so before any agreement can
// be computed there has to be something both of them were rating.
//
// Matching one coder's spans to the other's by overlap is the obvious
// alternative and it does not work, for a reason that is not obvious: kappa
// needs the *negative* agreements — the units neither coder coded — and a set
// built from spans that were coded has no negatives in it at all. The
// denominator is unbounded, and the resulting figure is not kappa.
//
// So the document is divided into units first, on a rule both coders' work is
// then read against. The division is exact rather than clever: paragraphs and
// lines are where the text says they are.

/**
 * How a document is divided.
 *
 * Sentences are missing on purpose. Splitting them needs a heuristic, every
 * heuristic is wrong on "Dr. Smith said so." and on transcription ellipses,
 * and its failure is invisible — a mis-split changes the denominator of every
 * kappa on that document and nothing on screen would show it. For an interview
 * transcript the speaker turn is the natural unit anyway, and that is a
 * paragraph.
 */
export type UnitKind = "paragraph" | "line";

export const UNIT_KINDS: ReadonlyArray<{ id: UnitKind; name: string; blurb: string }> = [
  {
    id: "paragraph",
    name: "Paragraph",
    blurb: "Split on blank lines. For a transcript this is usually one speaker turn.",
  },
  { id: "line", name: "Line", blurb: "Split on every line break." },
];

/** A stretch of the document both coders' work is read against. */
export interface Unit {
  index: number;
  start: number;
  end: number;
}

/**
 * Divide a document, keeping offsets into the original.
 *
 * Offsets, not copies — the fourth time in this codebase, for the same reason
 * every time: a stored copy drifts from its source invisibly, and here the
 * source is somebody's interview.
 *
 * Blank units are dropped. A run of empty lines is formatting, and counting it
 * as a unit neither coder coded inflates the negative agreements — which is
 * the half of kappa that is already hardest to reason about, and would make
 * agreement look better the more blank lines a transcript happened to contain.
 */
export function unitsOf(text: string, kind: UnitKind): Unit[] {
  const pattern = kind === "paragraph" ? /\n[ \t]*\n/g : /\n/g;
  const units: Unit[] = [];
  let from = 0;

  const push = (start: number, end: number) => {
    // Trim to the content, so a unit's offsets do not include the whitespace
    // that separated it from the next one.
    let a = start;
    let b = end;
    while (a < b && /\s/.test(text[a]!)) a += 1;
    while (b > a && /\s/.test(text[b - 1]!)) b -= 1;
    if (b > a) units.push({ index: units.length, start: a, end: b });
  };

  pattern.lastIndex = 0;
  let match = pattern.exec(text);
  while (match !== null) {
    push(from, match.index);
    from = match.index + match[0].length;
    match = pattern.exec(text);
  }
  push(from, text.length);

  return units;
}

/** Whether a span touches a unit at all. */
export function overlaps(unit: Unit, span: { start: number; end: number }): boolean {
  return span.start < unit.end && unit.start < span.end;
}
