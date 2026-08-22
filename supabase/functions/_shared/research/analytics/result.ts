// A statistical result, shaped so that the things §7 forbids cannot be built.
//
// The specification says: no p-value without n and an effect size; confidence
// intervals accompany estimates; non-significance is reported as
// non-significance and never as "no effect". Those are three rules, and a rule
// in a document is a rule somebody forgets at 2am.
//
// So they are not rules here. `Finding` has no `p` field that is not sitting
// beside `n` and `effect` in the same required object — a p-value on its own is
// not a value this module can produce, which is the same move as the
// diagnostic's tool schema having no field a quotation could be written into.
// The discipline is structural or it is decorative.
//
// ## Why the effect size is required rather than encouraged
//
// A p-value answers "would this happen by chance", and with a large enough
// sample the answer is no for effects too small to matter to anyone. A results
// table of asterisks is the single most common way a quantitative dissertation
// overstates what it found — and it is overstated in the direction the author
// wanted, which is why nobody catches it. The effect size is what makes the
// sentence "and it is this big" available at the same moment.

import { normalQuantile, studentQuantile } from "./distributions.ts";

/** Which family the effect size belongs to. Decides how it is described. */
export const EFFECT_KINDS = [
  "cohens_d", "hedges_g", "pearson_r", "spearman_rho", "eta_squared",
  "partial_eta_squared", "cramers_v", "odds_ratio", "cohens_w",
] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];

export interface Effect {
  kind: EffectKind;
  value: number;
  /**
   * A conventional label — small, medium, large — or null.
   *
   * Null wherever there is no convention worth quoting, and that is not a gap
   * to be filled. Cohen said explicitly that his benchmarks were a last resort
   * for fields with no better yardstick, and a tool that prints "medium"
   * against every effect in every discipline teaches researchers to read the
   * word instead of the number.
   */
  magnitude: "negligible" | "small" | "medium" | "large" | null;
}

export interface Interval {
  /** The estimate the interval is around. */
  estimate: number;
  lower: number;
  upper: number;
  /** 0.95 unless something says otherwise. */
  level: number;
}

/**
 * One statistical finding, whole.
 *
 * Every field is required. There is no partial constructor and no optional `p`
 * — that is the design, and adding `p?: number` "for the cases where an effect
 * size does not apply" would remove the only thing this file does. If a
 * procedure genuinely has no effect size, it does not produce a Finding.
 */
export interface Finding {
  /** e.g. "Welch's t-test", so the write-up can name the procedure. */
  test: string;
  /** The test statistic, with the symbol a methods chapter would print. */
  statistic: { symbol: string; value: number };
  degreesOfFreedom: number | { between: number; within: number };
  p: number;
  /** Total observations the test actually used, after missing data. */
  n: number;
  effect: Effect;
  /** Around the estimate the finding is about, not around the p. */
  interval: Interval;
  /**
   * How many tests were run in the family this belongs to.
   *
   * Carried on the finding rather than left to the write-up because it is the
   * fact most often lost between running the analysis and reporting it. One
   * test at .05 is a 5% chance of a false positive; twenty is 64%.
   */
  comparisons: number;
  /** Assumptions checked, and what they said. Never empty — see assumptions.ts. */
  assumptions: AssumptionCheck[];
}

export interface AssumptionCheck {
  name: string;
  /** `unmet` is not a failure. It is a finding about the data. */
  status: "met" | "unmet" | "not_assessable";
  detail: string;
  /** What to do about it, when it is unmet. */
  remedy?: string;
}

/**
 * How a finding should be said, in a sentence that cannot overstate it.
 *
 * Generated rather than left to prose because this is where the overstatement
 * happens. Three things are structural:
 *
 * - **Non-significance is reported as non-significance.** "No significant
 *   difference was detected" — not "there was no difference", which is a claim
 *   about the world that a failure to reject does not support.
 * - **The effect size is in the same sentence as the p**, so the reader cannot
 *   meet one without the other.
 * - **Multiplicity is stated when it exists**, in the sentence rather than a
 *   footnote nobody reads.
 */
export function describeFinding(finding: Finding): string {
  const df = typeof finding.degreesOfFreedom === "number"
    ? String(round(finding.degreesOfFreedom, 2))
    : `${finding.degreesOfFreedom.between}, ${finding.degreesOfFreedom.within}`;

  const statistic = `${finding.statistic.symbol}(${df}) = ${round(finding.statistic.value, 3)}`;
  const p = finding.p < 0.001 ? "p < .001" : `p = ${round(finding.p, 3).toFixed(3).replace(/^0/, "")}`;
  const effect = `${symbolFor(finding.effect.kind)} = ${round(finding.effect.value, 3)}`;
  const ci = `${Math.round(finding.interval.level * 100)}% CI [${round(finding.interval.lower, 3)}, ${round(finding.interval.upper, 3)}]`;

  const significant = finding.p < 0.05;
  const lead = significant
    ? `${finding.test} detected a difference`
    // The wording is the point. A non-significant result says nothing about
    // whether an effect exists; it says this study did not detect one.
    : `${finding.test} did not detect a difference`;

  const parts = [`${lead}, ${statistic}, ${p}, ${effect}, ${ci}, n = ${finding.n}.`];

  if (!significant) {
    parts.push(
      "This is not evidence that there is no difference — an undetected effect and an absent one look the same from here.",
    );
  }
  if (finding.comparisons > 1) {
    parts.push(
      `One of ${finding.comparisons} comparisons in this family; the p above is uncorrected.`,
    );
  }
  const unmet = finding.assumptions.filter((check) => check.status === "unmet");
  if (unmet.length > 0) {
    parts.push(`Assumption not met: ${unmet.map((check) => check.detail).join(" ")}`);
  }
  return parts.join(" ");
}

function symbolFor(kind: EffectKind): string {
  switch (kind) {
    case "cohens_d": return "d";
    case "hedges_g": return "g";
    case "pearson_r": return "r";
    case "spearman_rho": return "ρ";
    case "eta_squared": return "η²";
    case "partial_eta_squared": return "ηp²";
    case "cramers_v": return "V";
    case "odds_ratio": return "OR";
    case "cohens_w": return "w";
  }
}

export function round(value: number, places: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Cohen's conventional bands, and only where Cohen actually gave them.
 *
 * Returns null for kinds with no convention worth quoting rather than
 * inventing one. See the note on `Effect.magnitude`.
 */
export function magnitudeOf(kind: EffectKind, value: number): Effect["magnitude"] {
  const size = Math.abs(value);
  switch (kind) {
    case "cohens_d":
    case "hedges_g":
      if (size < 0.2) return "negligible";
      if (size < 0.5) return "small";
      if (size < 0.8) return "medium";
      return "large";
    case "pearson_r":
    case "spearman_rho":
      if (size < 0.1) return "negligible";
      if (size < 0.3) return "small";
      if (size < 0.5) return "medium";
      return "large";
    case "eta_squared":
    case "partial_eta_squared":
      if (size < 0.01) return "negligible";
      if (size < 0.06) return "small";
      if (size < 0.14) return "medium";
      return "large";
    case "cohens_w":
      if (size < 0.1) return "negligible";
      if (size < 0.3) return "small";
      if (size < 0.5) return "medium";
      return "large";
    // Cramér's V bands depend on the table's degrees of freedom, and an odds
    // ratio depends entirely on the base rate. Quoting one number for either
    // would be worse than saying nothing.
    case "cramers_v":
    case "odds_ratio":
      return null;
  }
}

/** A confidence interval around a mean or a mean difference. */
export function meanInterval(
  estimate: number,
  standardError: number,
  df: number,
  level = 0.95,
): Interval {
  const critical = studentQuantile(1 - level, df);
  return {
    estimate,
    lower: estimate - critical * standardError,
    upper: estimate + critical * standardError,
    level,
  };
}

/**
 * A confidence interval for a correlation, via Fisher's z.
 *
 * Not estimate ± 1.96 × SE. The sampling distribution of r is skewed as it
 * approaches ±1, so a symmetric interval can put a bound past 1 — which is not
 * a wide interval, it is an impossible one, and it appears in published papers.
 */
export function correlationInterval(r: number, n: number, level = 0.95): Interval {
  if (n < 4) return { estimate: r, lower: Number.NaN, upper: Number.NaN, level };
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const critical = normalQuantile(1 - (1 - level) / 2);
  const back = (value: number) => (Math.exp(2 * value) - 1) / (Math.exp(2 * value) + 1);
  return { estimate: r, lower: back(z - critical * se), upper: back(z + critical * se), level };
}
