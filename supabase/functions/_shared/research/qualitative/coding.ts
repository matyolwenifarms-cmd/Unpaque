// A code applied to an exact segment of a document.
//
// Offsets, for the third time in this repository and for the same reason: a
// coding that stored a copy of the text would drift from the transcript the
// moment either was edited, and nothing would say so. The extract is sliced
// from the document at render time, so it is necessarily what is in the
// document.
//
// **Overlap is allowed here, unlike the diagnostic's annotations.** That is not
// an oversight. Qualitative coding routinely applies two codes to the same
// words - a passage can be about both cost and trust - and a model that
// refused it would force the analyst to choose which reading to record. The
// annotation engine forbids overlap because two highlights over one phrase
// cannot both be rendered; here they can, stacked.

export interface Coding {
  id: string;
  documentId: string;
  codeId: string;
  /** Offsets into the document, exactly as stored. */
  start: number;
  end: number;
  /** The coder's note on why this code, here. Optional and often the best part. */
  memo?: string | null;
  /** Who applied it. Needed for agreement between coders. */
  coderId?: string | null;
}

export const MIN_EXTRACT_CHARS = 3;

export interface CodingProblem {
  kind: "out_of_bounds" | "empty" | "too_short" | "whole_document";
  says: string;
}

/**
 * Whether a coding can be applied to this document.
 *
 * The whole-document check is a judgement rather than a bound, and it is here
 * because it is the commonest way a codebook stops discriminating: a code
 * applied to an entire transcript says the transcript is about that, which may
 * be true and is not a coding. It refuses, and says why.
 */
export function codingProblems(
  coding: Pick<Coding, "start" | "end">,
  documentText: string,
): CodingProblem[] {
  const problems: CodingProblem[] = [];
  const { start, end } = coding;

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > documentText.length) {
    problems.push({
      kind: "out_of_bounds",
      says: `That selection is outside the document (${start}-${end} of ${documentText.length}).`,
    });
    return problems;
  }
  if (end <= start || documentText.slice(start, end).trim() === "") {
    problems.push({ kind: "empty", says: "Nothing is selected." });
    return problems;
  }
  if (documentText.slice(start, end).trim().length < MIN_EXTRACT_CHARS) {
    problems.push({ kind: "too_short", says: "That is too short to be an extract." });
  }
  if (end - start >= documentText.trim().length) {
    problems.push({
      kind: "whole_document",
      says:
        "That is the whole document. A code applied to everything stops distinguishing anything - code the passage that shows it.",
    });
  }
  return problems;
}

/** The text a coding points at. Sliced, never stored. */
export function extractOf(coding: Pick<Coding, "start" | "end">, documentText: string): string {
  return documentText.slice(coding.start, coding.end);
}

// Letters, digits, and both apostrophes, plus the hyphen. The curly apostrophe
// is the escape rather than the character: transcripts arrive from tools that
// smarten quotes, an editor here could smarten this one, and a range nobody
// can see is a range nobody can review.
const WORD_CHARACTER = /[\p{L}\p{N}'\u2019-]/u;

/**
 * Widen an extract to whole words.
 *
 * A selection dragged with a mouse lands mid-word constantly, and an extract
 * beginning "esistance to the change" reads as a transcription error in a
 * findings chapter. Widened rather than refused: unlike a model returning
 * offsets, a human dragging a selection has said what they mean and the
 * boundary is a slip.
 */
export function toWholeWords(
  text: string,
  start: number,
  end: number,
): { start: number; end: number } {
  let from = Math.max(0, Math.min(start, text.length));
  let to = Math.max(from, Math.min(end, text.length));
  while (from > 0 && WORD_CHARACTER.test(text[from - 1]!) && WORD_CHARACTER.test(text[from]!)) {
    from -= 1;
  }
  while (to < text.length && WORD_CHARACTER.test(text[to]!) && WORD_CHARACTER.test(text[to - 1]!)) {
    to += 1;
  }
  return { start: from, end: to };
}

/** How often each pair of codes is applied to overlapping text. */
export function coOccurrence(
  codings: readonly Coding[],
): Array<{ a: string; b: string; count: number }> {
  const counts = new Map<string, number>();
  for (let i = 0; i < codings.length; i += 1) {
    for (let j = i + 1; j < codings.length; j += 1) {
      const one = codings[i]!;
      const other = codings[j]!;
      if (one.documentId !== other.documentId) continue;
      if (one.codeId === other.codeId) continue;
      if (one.start >= other.end || other.start >= one.end) continue;
      // Ordered, so "cost with trust" and "trust with cost" are one pair and
      // not two half-counted ones.
      const [a, b] = one.codeId < other.codeId
        ? [one.codeId, other.codeId]
        : [other.codeId, one.codeId];
      const key = `${a} ${b}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [a, b] = key.split(" ");
      return { a: a!, b: b!, count };
    })
    .sort((x, y) => y.count - x.count || x.a.localeCompare(y.a));
}

/** A stretch of the document and every code covering it. */
export interface Layer {
  start: number;
  end: number;
  /** Sliced from the document. Never a stored copy. */
  text: string;
  /** Ordered by where each coding begins, so the innermost is last. */
  codeIds: string[];
  codingIds: string[];
}

/**
 * Cut the document at every coding boundary.
 *
 * The diagnostic's `segments()` cannot be reused here, and the difference is
 * the point: it refuses overlapping annotations, because two devices claiming
 * the same phrase is a model contradicting itself. Overlapping codings are
 * ordinary - "resistance" and "cost" over the same sentence is a researcher
 * saying it is both, and `coOccurrence()` exists to count exactly that.
 *
 * So the text is cut at every start and end, and each piece carries the set of
 * codes covering it rather than one. The alternative - a highlight per coding,
 * drawn over the text - needs absolute positioning against a reflowing
 * paragraph, and is wrong at every window width but the one it was built at.
 */
export function layers(text: string, codings: readonly Coding[]): Layer[] {
  const within = codings.filter(
    (coding) => coding.start < coding.end && coding.start >= 0 && coding.end <= text.length,
  );
  const boundaries = new Set<number>([0, text.length]);
  for (const coding of within) {
    boundaries.add(coding.start);
    boundaries.add(coding.end);
  }

  const cuts = [...boundaries].sort((a, b) => a - b);
  const pieces: Layer[] = [];
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const start = cuts[i]!;
    const end = cuts[i + 1]!;
    if (end <= start) continue;
    const covering = within
      .filter((coding) => coding.start <= start && coding.end >= end)
      .sort((a, b) => a.start - b.start || b.end - a.end);
    pieces.push({
      start,
      end,
      text: text.slice(start, end),
      codeIds: covering.map((coding) => coding.codeId),
      codingIds: covering.map((coding) => coding.id),
    });
  }
  return pieces;
}
