// Turning extracted text into text a passage can be selected from, without
// losing the ability to point back at where it came from.
//
// The whole passage feature rests on one property: a displayed quotation is a
// *substring of the retrieved source*, sliced by offset, never a string a model
// wrote. That makes a fabricated quotation not merely forbidden but
// inexpressible. It only holds if the offsets are right, which is why this
// module carries a mapping rather than just cleaning the text up.
//
// The cleaning is not optional either. Text extracted from a PDF arrives with
// words split across line breaks by hyphens, with single newlines inside
// paragraphs, and with runs of spaces where the layout had columns. Selecting
// a span out of that gives a quotation containing "communi- cation", which a
// reader will reasonably read as carelessness about the source.

export interface NormalisedText {
  /** What passages are selected from. */
  text: string;
  /** The text exactly as extracted. Deep links point in here. */
  source: string;
  /**
   * `offsets[i]` is the index in `source` of the character at `text[i]`.
   * One entry per character of `text`, plus a final entry for the end.
   */
  offsets: number[];
}

const QUOTE_MAP: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "‛": "'",
  "“": '"', "”": '"', "„": '"', "‟": '"',
  "–": "-", "—": "-", "−": "-",
  " ": " ", " ": " ", " ": " ",
};

/**
 * A hyphen at the end of a line, followed by a lower-case letter at the start
 * of the next, is almost always a word broken by typesetting rather than a
 * real hyphen.
 *
 * "almost" is doing work: "well-\nknown" is a genuine compound and this will
 * join it into "wellknown". The alternative — leaving every line-break hyphen
 * alone — produces "communi- cation" in real quotations, which is the more
 * common and more visibly wrong outcome. The rule declines to join when the
 * next line starts with a capital, which catches proper nouns and most
 * genuine compounds at a line break.
 */
const LINE_BREAK_HYPHEN = /(\w)-\n[ \t]*([a-z])/g;

export function normalise(source: string): NormalisedText {
  const chars: string[] = [];
  const offsets: number[] = [];

  // Precompute which source indices are part of a hyphen-newline join, so the
  // main pass can skip them while still recording honest offsets for the
  // characters it does keep.
  const skipped = new Set<number>();
  for (const match of source.matchAll(LINE_BREAK_HYPHEN)) {
    const start = match.index!;
    // Skip the hyphen and everything up to the letter on the next line.
    const hyphenAt = start + match[1]!.length;
    const resumeAt = start + match[0]!.length - match[2]!.length;
    for (let i = hyphenAt; i < resumeAt; i += 1) skipped.add(i);
  }

  let pendingSpace = false;
  let pendingSpaceOffset = 0;

  for (let i = 0; i < source.length; i += 1) {
    if (skipped.has(i)) continue;
    const raw = source[i]!;
    const mapped = QUOTE_MAP[raw] ?? raw;

    if (/\s/.test(mapped)) {
      // Runs of whitespace collapse to one space, and the offset recorded is
      // the *first* whitespace character. Pointing at the first is what makes a
      // highlight start where a reader expects it.
      if (!pendingSpace) {
        pendingSpace = true;
        pendingSpaceOffset = i;
      }
      continue;
    }

    if (pendingSpace) {
      // Leading whitespace produces no space at all, so a passage never begins
      // with one.
      if (chars.length > 0) {
        chars.push(" ");
        offsets.push(pendingSpaceOffset);
      }
      pendingSpace = false;
    }

    chars.push(mapped);
    offsets.push(i);
  }

  // One past the end, so a span ending at text.length has a source offset.
  offsets.push(source.length);

  return { text: chars.join(""), source, offsets };
}

/** The source range a normalised span came from. */
export function toSourceRange(
  doc: NormalisedText,
  start: number,
  end: number,
): { start: number; end: number } | null {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end > doc.text.length || start >= end) return null;
  return { start: doc.offsets[start]!, end: doc.offsets[end]! };
}
