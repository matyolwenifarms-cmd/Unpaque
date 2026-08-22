// Multiple comparisons: counted always, corrected on request.
//
// §7 says the count is reported and a correction offered when it exceeds one.
// Offered, not applied — which is the whole design. Bonferroni on twenty
// exploratory comparisons can bury every real effect in the study, and a tool
// that silently applied it would be making a decision about statistical power
// that belongs to the researcher. So `familyOf` always states the inflated
// error rate, and the corrections are there to be chosen.
//
// The number that does the work is the first sentence of `familyOf`: twenty
// tests at .05 is a 64% chance of at least one false positive. Almost nobody
// running twenty tests has that number in mind, and once they do the argument
// about which correction to use tends to settle itself.

export const CORRECTIONS = ["bonferroni", "holm", "benjamini_hochberg"] as const;
export type Correction = (typeof CORRECTIONS)[number];

export interface Family {
  /** How many tests were run. */
  comparisons: number;
  /** Per-test α before any correction. */
  alpha: number;
  /** P(at least one false positive) across the family, if nothing is done. */
  familywiseError: number;
  /** Always present, and plain. */
  says: string;
}

export function familyOf(comparisons: number, alpha = 0.05): Family {
  const familywiseError = comparisons <= 1 ? alpha : 1 - (1 - alpha) ** comparisons;
  return {
    comparisons,
    alpha,
    familywiseError,
    says: comparisons <= 1
      ? `One comparison at α = ${alpha}.`
      : `${comparisons} comparisons at α = ${alpha}. If none of them were real, the chance of at least one coming out significant anyway is ${Math.round(familywiseError * 100)}%.`,
  };
}

export interface Adjusted {
  /** Index into the p-values as they were given. Order is never disturbed. */
  index: number;
  p: number;
  adjustedP: number;
  significant: boolean;
}

/**
 * Adjust a family of p-values.
 *
 * Returns them in the caller's original order, always. Sorting is an
 * implementation detail of Holm and Benjamini–Hochberg, and returning sorted
 * results would silently detach every p from the comparison it belongs to —
 * a mistake that produces a results table where the labels are right and the
 * numbers are somebody else's.
 */
export function adjust(
  pValues: readonly number[],
  method: Correction,
  alpha = 0.05,
): Adjusted[] {
  const m = pValues.length;
  if (m === 0) return [];

  const indexed = pValues.map((p, index) => ({ p, index }));
  const ascending = [...indexed].sort((a, b) => a.p - b.p);
  const adjusted = new Array<number>(m);

  if (method === "bonferroni") {
    for (const { p, index } of indexed) adjusted[index] = Math.min(1, p * m);
  } else if (method === "holm") {
    // Step-down, with the running maximum that keeps the adjusted values
    // monotone — without it a later p can come out smaller than an earlier
    // one, which is not a rounding artefact but a contradiction.
    let running = 0;
    ascending.forEach(({ p, index }, rank) => {
      running = Math.max(running, Math.min(1, (m - rank) * p));
      adjusted[index] = running;
    });
  } else {
    // Benjamini–Hochberg, stepping up from the largest, with the running
    // minimum for the same monotonicity reason.
    let running = 1;
    for (let rank = m - 1; rank >= 0; rank -= 1) {
      const { p, index } = ascending[rank]!;
      running = Math.min(running, Math.min(1, (m / (rank + 1)) * p));
      adjusted[index] = running;
    }
  }

  return indexed.map(({ p, index }) => ({
    index,
    p,
    adjustedP: adjusted[index]!,
    significant: adjusted[index]! < alpha,
  }));
}

/**
 * What each correction is for, in a sentence, so the choice is informed.
 *
 * Bonferroni is the one everybody knows and the one that costs the most power;
 * saying so is the difference between a researcher choosing it and defaulting
 * to it.
 */
export const CORRECTION_NOTES: Readonly<Record<Correction, string>> = {
  bonferroni:
    "Controls the chance of any false positive across the family. Simple, conservative, and on a large family it can hide real effects — the cost is paid in power.",
  holm:
    "Controls the same thing as Bonferroni and is never less powerful, so there is no situation where Bonferroni is the better of the two. Prefer it unless a reviewer has asked for Bonferroni by name.",
  benjamini_hochberg:
    "Controls the proportion of your significant results that are false, rather than the chance of any. Appropriate for exploratory work where some false positives are acceptable and missing real effects is not.",
};
