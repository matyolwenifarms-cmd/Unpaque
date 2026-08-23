// Comparing two statements, for both features that have to.
//
// Detect asks whether two witnesses disagree. Research asks whether two papers
// report different figures for the same thing. The question is the same
// arithmetic and the obligations are not: §10 requires a contradiction record
// to carry explanations and a significance, and a systematic review requires
// something else again. So the comparison lives here and the record shapes
// stay with the feature that owes them.
//
// The conservative half is the whole design, and it is inherited from §10's
// warning: do not label something a contradiction merely because the wording
// differs. A system that flags every rephrasing produces a wall of findings a
// reader learns to dismiss, and the real conflict three rows down goes with
// them.

/**
 * Words with no propositional content, stripped before comparison.
 *
 * The list is short on purpose. Stripping aggressively makes two genuinely
 * different statements collide, and an engine that misses real conflicts is
 * worse than one that reports a few extra.
 */
const FILLER = new Set([
  "a", "an", "the", "that", "this", "then", "just", "very", "quite",
  "approximately", "about", "around", "roughly",
]);

/** Case, whitespace, typographic punctuation, and the filler above. */
export function normaliseStatement(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    // A token of pure punctuation carries no content. Apostrophes and hyphens
    // are kept inside words — "o'clock", "twenty-two" — but a dash left
    // standing alone by the substitutions above would otherwise survive as a
    // word and make an em-dash the difference between two identical accounts.
    .filter((word) => word !== "" && /[\p{L}\p{N}]/u.test(word) && !FILLER.has(word))
    .join(" ");
}

/**
 * Whether two statements say the same thing in different words.
 *
 * §10's warning, as a function that can be called rather than a caution that
 * has to be remembered. Deliberately conservative: it answers "are these
 * plainly the same", not "do these mean the same", which no deterministic
 * check can decide.
 */
export function differsOnlyInWording(a: string, b: string): boolean {
  return normaliseStatement(a) === normaliseStatement(b);
}

/** A number as it appears, with the words either side, so context survives. */
export interface NumberInContext {
  value: number;
  raw: string;
  /** Up to three words before and after, normalised. */
  context: string;
  /**
   * The word immediately after, which in English is usually the unit.
   *
   * `40 incidents` and `52 incidents` measure the same thing; `2018 cohort`
   * and `52 incidents` do not, and their surrounding words overlap enough to
   * pass the context threshold anyway. Empty where the number ends the text.
   */
  unit: string;
}

export function numbersIn(text: string): NumberInContext[] {
  const words = normaliseStatement(text).split(" ");
  const found: NumberInContext[] = [];
  for (const [index, word] of words.entries()) {
    // Commas and spaces as thousands separators are already stripped by
    // normalisation, so "1,200" arrives as "1" and "200". Rejoining is not
    // worth it here: a split number produces two candidates that both fail to
    // match rather than one that matches wrongly.
    const value = Number(word.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(value) || word.replace(/[^\d]/g, "") === "") continue;
    found.push({
      value,
      raw: word,
      context: [
        ...words.slice(Math.max(0, index - 3), index),
        ...words.slice(index + 1, index + 4),
      ].join(" "),
      unit: words[index + 1] ?? "",
    });
  }
  return found;
}

/** Proportion of words shared between two contexts. */
export function overlap(a: string, b: string): number {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

export interface Disagreement {
  left: NumberInContext;
  right: NumberInContext;
}

export interface DisagreementOptions {
  /**
   * How similar the surrounding words must be before a differing number counts
   * as the *same* figure disagreeing rather than two unrelated figures. High
   * by default: two documents mentioning unrelated numbers is the common case,
   * and flagging those is the wall of noise §10 warns about.
   */
  contextOverlap?: number;
  /**
   * Require both numbers to be followed by the same word.
   *
   * Off by default, and the two callers choose differently for a reason. A
   * witness statement is short and its numbers often end a clause — "he
   * arrived at 9" has no unit at all — so requiring one there discards the
   * conflicts Detect exists to find. A research paper is long and full of
   * years, and without this rule `the 2018 cohort reported 40 incidents`
   * against `the 2018 cohort reported 52 incidents` yields three
   * disagreements: the real one, and two pairing a year against a count whose
   * surrounding words overlap quite enough to pass the threshold.
   */
  requireSameUnit?: boolean;
}

/**
 * Numbers that disagree while describing the same thing.
 *
 * The conservative half is the context comparison. "Forty were affected" and
 * "the contract ran forty-two months" both contain numbers and contradict
 * nothing; only figures whose surrounding words substantially agree come back.
 *
 * Each pair of values is reported once. Two documents that both mention the
 * same two figures produce one disagreement, not four — the caller is
 * writing a finding per disagreement, and four findings saying the same thing
 * is how a reader learns to skim them.
 */
export function numericDisagreements(
  a: string,
  b: string,
  options: DisagreementOptions = {},
): Disagreement[] {
  const threshold = options.contextOverlap ?? 0.6;
  const found: Disagreement[] = [];
  const seen = new Set<string>();

  for (const left of numbersIn(a)) {
    for (const right of numbersIn(b)) {
      if (left.value === right.value) continue;
      if (options.requireSameUnit && (left.unit === "" || left.unit !== right.unit)) continue;
      if (overlap(left.context, right.context) < threshold) continue;

      const key = `${left.value}:${right.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ left, right });
    }
  }

  return found;
}
