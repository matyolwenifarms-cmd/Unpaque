import type { Discrepancy, Explanation, TimelineEvent } from "./timeline.ts";

// The contradiction engine, §10.
//
// The specification's warning is the hard part: "Do not automatically label
// something a contradiction merely because wording differs. Use POTENTIAL
// CONTRADICTION until verified."
//
// A system that flags every rephrasing produces a wall of findings a reader
// learns to dismiss, and the real contradiction three rows down goes with them.
// So the detectors here look for specific structural conflicts — a number that
// changed, a time that moved — and there is an explicit check that two accounts
// differing only in wording are not reported at all.
//
// Nothing here ever produces `verified`. §10 reserves that for a human, and
// §3 keeps human authority explicit for consequential decisions.

export const CONTRADICTION_TYPES = [
  "direct",
  "temporal",
  "geographic",
  "narrative",
  "documentary",
  "evidentiary",
] as const;

export type ContradictionType = (typeof CONTRADICTION_TYPES)[number];

export const CONTRADICTION_STATUSES = ["potential", "verified", "resolved"] as const;
export type ContradictionStatus = (typeof CONTRADICTION_STATUSES)[number];

/** §10's required record. Every field is required because §10 requires it. */
export interface ContradictionRecord {
  type: ContradictionType;
  sourceA: string;
  sourceB: string;
  /** The exact difference, quoted or measured — never "these disagree". */
  difference: string;
  explanations: Explanation[];
  /** Why it matters to the investigation, in one sentence. */
  significance: string;
  status: ContradictionStatus;
}

/**
 * Normalise for comparison: case, whitespace, typographic punctuation, and the
 * words that carry no propositional content.
 *
 * The stopword list is short on purpose. Stripping aggressively makes two
 * genuinely different statements collide, and a contradiction engine that
 * misses real conflicts is worse than one that reports a few extra.
 */
const FILLER = new Set([
  "a", "an", "the", "that", "this", "then", "just", "very", "quite",
  "approximately", "about", "around", "roughly",
]);

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

// A note on where this is and is not used, because it was briefly called from
// findNumericConflicts and could not possibly fire there: if two statements
// normalise identically then every number in them is identical too, so there
// was never a numeric conflict for the guard to suppress. A negative control
// found it — removing the guard changed nothing.
//
// It belongs on any comparison of *prose* — narrative and direct
// contradictions, where "the meeting was moved" and "the meeting was
// rescheduled" must not be reported. Numeric comparison gets its safety from
// the context-overlap threshold instead, which is a different mechanism doing
// a different job.

/** Numbers as they appear, with the words either side, so context survives. */
interface NumberInContext {
  value: number;
  raw: string;
  /** Up to three words before and after, normalised. */
  context: string;
}

function numbersIn(text: string): NumberInContext[] {
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
      context: [...words.slice(Math.max(0, index - 3), index), ...words.slice(index + 1, index + 4)].join(" "),
    });
  }
  return found;
}

/** Proportion of words shared between two contexts. */
function overlap(a: string, b: string): number {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

export interface StatementUnderComparison {
  sourceId: string;
  text: string;
}

export interface NumericConflictOptions {
  /**
   * How similar the surrounding words must be before a differing number counts
   * as the *same* figure disagreeing rather than two unrelated figures. High by
   * default: two documents mentioning unrelated numbers is the common case, and
   * flagging those is the wall of noise §10 warns about.
   */
  contextOverlap?: number;
}

/**
 * Numbers that disagree while describing the same thing.
 *
 * The conservative half is the context comparison. "Forty were affected" and
 * "the contract ran forty-two months" both contain numbers and contradict
 * nothing; only figures whose surrounding words substantially agree are
 * reported.
 */
export function findNumericConflicts(
  a: StatementUnderComparison,
  b: StatementUnderComparison,
  options: NumericConflictOptions = {},
): ContradictionRecord[] {
  const threshold = options.contextOverlap ?? 0.6;
  const records: ContradictionRecord[] = [];
  const seen = new Set<string>();

  for (const left of numbersIn(a.text)) {
    for (const right of numbersIn(b.text)) {
      if (left.value === right.value) continue;
      if (overlap(left.context, right.context) < threshold) continue;

      const key = `${left.value}:${right.value}`;
      if (seen.has(key)) continue;
      seen.add(key);

      records.push({
        type: "documentary",
        sourceA: a.sourceId,
        sourceB: b.sourceId,
        difference: `${left.raw} against ${right.raw}, in otherwise matching wording`,
        explanations: [
          {
            summary: "The two figures count different things, despite similar phrasing.",
            distinguishedBy: "The definition each source uses, stated in its own text or methodology.",
          },
          {
            summary: "The figures are from different dates and both were correct when written.",
            distinguishedBy: "The date each source's figure was compiled, as distinct from its publication date.",
          },
          {
            summary: "One figure was revised and the other reproduces the earlier version.",
            distinguishedBy: "Whether either source issued a correction, and which came first.",
          },
          {
            summary: "One figure is wrong.",
            distinguishedBy: "A third independent source, or the underlying record both are drawn from.",
          },
        ],
        significance:
          "The two sources cannot both be describing the same quantity accurately; which is correct affects anything resting on either.",
        status: "potential",
      });
    }
  }

  return records;
}

/**
 * Turn a timeline discrepancy into a contradiction record.
 *
 * The explanations come with the discrepancy rather than being written again
 * here — one catalogue, so a change to how the system talks about temporal
 * conflicts cannot apply in one place and not the other.
 */
export function fromTimelineDiscrepancy(discrepancy: Discrepancy): ContradictionRecord {
  const describe = (event: TimelineEvent) => `${event.label} at ${event.at}`;
  return {
    type: "temporal",
    sourceA: discrepancy.a.sourceId,
    sourceB: discrepancy.b.sourceId,
    difference:
      `${describe(discrepancy.a)} against ${describe(discrepancy.b)} — ` +
      `${discrepancy.differenceMinutes} minutes apart`,
    explanations: discrepancy.explanations,
    significance:
      "The two records place the same moment at different times; which is right determines what else was possible.",
    status: "potential",
  };
}

/**
 * Everything a record must carry before it is fit to show anybody.
 *
 * §10 lists the required fields, and a record missing its explanations or its
 * significance is the bare assertion of conflict the section exists to prevent.
 * Returning the reasons rather than a boolean means a caller can say what is
 * missing instead of silently dropping the record.
 */
export function recordProblems(record: ContradictionRecord): string[] {
  const problems: string[] = [];
  if (record.sourceA === record.sourceB) problems.push("a source cannot contradict itself");
  if (record.difference.trim() === "") problems.push("the exact difference is not stated");
  if (record.explanations.length < 2) {
    problems.push("fewer than two possible explanations — a single explanation is a conclusion");
  }
  for (const explanation of record.explanations) {
    if (explanation.distinguishedBy.trim() === "") {
      problems.push(`no evidence named that would settle: ${explanation.summary}`);
    }
  }
  if (record.significance.trim() === "") problems.push("significance to the investigation is not stated");
  return problems;
}
