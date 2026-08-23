import { numericDisagreements } from "../relations/compare.ts";
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

// The comparison itself lives in `_shared/relations/compare.ts`, because
// Research asks the same question of two papers and the arithmetic does not
// change between them. What stays here is what §10 owes on top of it: the six
// contradiction types, the explanations, the significance, and the rule that
// nothing produced by software is ever `verified`.
//
// Re-exported rather than left to callers to import from two places. The
// dossier and the case view have imported `normaliseStatement` from this
// module since before the seam existed, and moving a file should not be an
// API change for everything that reads it.
export {
  differsOnlyInWording,
  normaliseStatement,
} from "../relations/compare.ts";

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
  const disagreements = numericDisagreements(
    a.text,
    b.text,
    options.contextOverlap === undefined ? {} : { contextOverlap: options.contextOverlap },
  );

  return disagreements.map(({ left, right }) => ({
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
  }));
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
