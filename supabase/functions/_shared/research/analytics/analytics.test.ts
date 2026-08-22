import { describe, expect, it } from "vitest";
import { adjust, familyOf, CORRECTION_NOTES, CORRECTIONS } from "./corrections.ts";
import { cronbachAlpha, mcdonaldOmega } from "./reliability.ts";
import { checkCausalClaim, inspectClaim, mayClaimCause, type Design } from "./causal.ts";
import { homogeneityOfVariance, independence, normality } from "./assumptions.ts";

describe("multiple comparisons", () => {
  it("states the inflated error rate in a number a researcher can act on", () => {
    expect(familyOf(1).says).toMatch(/One comparison/);
    const twenty = familyOf(20);
    // 1 − .95²⁰ = .642.
    expect(twenty.familywiseError).toBeCloseTo(0.6415, 3);
    expect(twenty.says).toMatch(/64%/);
  });

  it("Bonferroni multiplies by the family size and caps at 1", () => {
    const out = adjust([0.01, 0.04, 0.5], "bonferroni");
    expect(out[0]!.adjustedP).toBeCloseTo(0.03, 10);
    expect(out[1]!.adjustedP).toBeCloseTo(0.12, 10);
    expect(out[2]!.adjustedP).toBe(1);
  });

  // Holm is never less powerful than Bonferroni, so there is no situation in
  // which Bonferroni is the better of the two.
  it("Holm is never more conservative than Bonferroni", () => {
    const p = [0.001, 0.008, 0.039, 0.041, 0.042, 0.6];
    const holm = adjust(p, "holm");
    const bonferroni = adjust(p, "bonferroni");
    for (let i = 0; i < p.length; i += 1) {
      expect(holm[i]!.adjustedP).toBeLessThanOrEqual(bonferroni[i]!.adjustedP + 1e-12);
    }
  });

  it("keeps adjusted values monotone in the original p order", () => {
    for (const method of CORRECTIONS) {
      const p = [0.001, 0.008, 0.039, 0.041, 0.042, 0.6];
      const out = adjust(p, method).map((row) => row.adjustedP);
      for (let i = 1; i < out.length; i += 1) {
        // p is already ascending, so adjusted must be too. Without the running
        // max/min a later p can come out smaller — a contradiction, not a
        // rounding artefact.
        expect(out[i]!).toBeGreaterThanOrEqual(out[i - 1]! - 1e-12);
      }
    }
  });

  // Returning sorted results would silently detach every p from the comparison
  // it belongs to: a table where the labels are right and the numbers are
  // somebody else's.
  it("returns results in the order they were given, never sorted", () => {
    const out = adjust([0.5, 0.001, 0.2], "holm");
    expect(out.map((row) => row.index)).toEqual([0, 1, 2]);
    expect(out.map((row) => row.p)).toEqual([0.5, 0.001, 0.2]);
  });

  it("says what each correction costs", () => {
    expect(CORRECTION_NOTES.bonferroni).toMatch(/power/);
    expect(CORRECTION_NOTES.holm).toMatch(/never less powerful/);
    expect(CORRECTION_NOTES.benjamini_hochberg).toMatch(/exploratory/);
  });
});

describe("reliability", () => {
  const consistent = [
    [4, 4, 5, 4], [2, 2, 1, 2], [5, 5, 5, 5], [3, 3, 2, 3],
    [1, 1, 2, 1], [4, 5, 4, 4], [2, 1, 2, 2], [5, 4, 5, 5],
  ];

  it("is high for items that move together", () => {
    const outcome = cronbachAlpha(consistent);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.reliability.coefficient).toBeGreaterThan(0.9);
    expect(outcome.reliability.items).toBe(4);
    expect(outcome.reliability.n).toBe(8);
  });

  it("is low for items that do not", () => {
    const outcome = cronbachAlpha([
      [1, 5, 2, 4], [5, 1, 4, 2], [2, 4, 5, 1], [4, 2, 1, 5],
      [3, 3, 3, 3], [1, 4, 3, 2], [5, 2, 1, 4], [2, 5, 4, 1],
    ]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.reliability.coefficient).toBeLessThan(0.5);
  });

  it("reports what dropping each item would do", () => {
    const outcome = cronbachAlpha(consistent);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.reliability.alphaIfDropped).toHaveLength(4);
  });

  // α rises with length whether or not the items measure anything, and "α = .84"
  // on a twenty-item scale then gets reported as evidence of a construct.
  it("warns that a long scale inflates the coefficient", () => {
    const long = Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 16 }, (_, c) => ((r * 7 + c * 3) % 5) + 1));
    const outcome = cronbachAlpha(long);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.reliability.says).toMatch(/rises with length/);
  });

  it("warns at the top end that near-duplicates are not reliability", () => {
    const identical = [[1, 1, 1], [2, 2, 2], [3, 3, 3], [4, 4, 4], [5, 5, 5]];
    const outcome = cronbachAlpha(identical);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.reliability.says).toMatch(/redundancy rather than reliability/);
  });

  it("refuses rather than returning a number it cannot support", () => {
    expect(cronbachAlpha([[1], [2], [3]]).ok).toBe(false);
    expect(cronbachAlpha([[1, 2]]).ok).toBe(false);
  });

  it("ω says what its factor estimate simplifies", () => {
    const outcome = mcdonaldOmega(consistent);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.reliability.coefficient).toBeGreaterThan(0.8);
    expect(outcome.reliability.says).toMatch(/principal component rather than a maximum-likelihood/);
  });
});

describe("a correlational design cannot claim cause", () => {
  const correlational: Design = { kind: "correlational", randomised: false };
  const experiment: Design = { kind: "experimental", randomised: true };

  it("knows which designs may", () => {
    expect(mayClaimCause(experiment)).toBe(true);
    expect(mayClaimCause(correlational)).toBe(false);
    // Not randomisation, but a named strategy the researcher must defend.
    expect(mayClaimCause({
      kind: "quasi_experimental",
      randomised: false,
      identificationStrategy: "Regression discontinuity at the funding cutoff.",
    })).toBe(true);
    // And not any of the three things that usually stand in for it.
    expect(mayClaimCause({ kind: "correlational", randomised: false, identificationStrategy: "   " })).toBe(false);
  });

  it.each([
    "Social media use causes lower wellbeing.",
    "Higher engagement leads to better retention.",
    "The intervention resulted in improved scores.",
    "We examined the effect of framing on recall.",
    "More exposure increases trust in the institution.",
    "Attitudes shifted because of the campaign.",
    "The change was driven by the new policy.",
    "The message makes people distrust the sender.",
  ])("refuses: %s", (claim) => {
    const outcome = checkCausalClaim(claim, correlational);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.says).toMatch(/cannot support a claim about cause/);
    expect(outcome.says).toMatch(/associated with/);
  });

  it.each([
    "Social media use was associated with lower wellbeing.",
    "Engagement and retention varied together across the sample.",
    "Scores were higher among participants in the second condition.",
    "Framing and recall were related, though the direction cannot be established here.",
  ])("passes: %s", (claim) => {
    expect(checkCausalClaim(claim, correlational).ok).toBe(true);
  });

  // The guard is about the mismatch, not the vocabulary. An experiment has
  // earned the word, and refusing it would teach researchers to hedge findings
  // they can actually defend.
  it("lets an experiment say causes", () => {
    expect(checkCausalClaim("The intervention causes higher recall.", experiment).ok).toBe(true);
  });

  // A guard that swallowed these would leave the write-up unable to describe
  // its own limitations, which is the opposite of what it is for.
  it.each([
    "This is a correlational design, so no causal claim is available.",
    "The causal question remains open.",
    "A causal inference would require random allocation.",
    "Causal modelling is outside the scope of this study.",
  ])("does not refuse the methodological sentence: %s", (sentence) => {
    expect(inspectClaim(sentence, "limitations")).toEqual([]);
  });
});

describe("assumptions are reported, never enforced", () => {
  it("normality says unknown below the n where it could detect anything", () => {
    const check = normality([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(check.status).toBe("not_assessable");
    expect(check.detail).toMatch(/cannot detect a violation/);
  });

  it("normality detects a clear departure on a large enough sample", () => {
    // Strongly right-skewed.
    const skewed = Array.from({ length: 200 }, (_, i) => Math.exp(i / 40));
    expect(normality(skewed).status).toBe("unmet");
  });

  it("normality passes symmetric data", () => {
    const symmetric = Array.from({ length: 200 }, (_, i) => Math.sin(i) + Math.cos(i * 1.7));
    expect(["met", "unmet"]).toContain(normality(symmetric).status);
  });

  it("Levene finds unequal variance and passes equal", () => {
    const equal = homogeneityOfVariance([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]]);
    expect(equal.status).toBe("met");
    const unequal = homogeneityOfVariance([
      [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      [1, 50, 2, 90, 3, 70, 4, 100, 5, 80],
    ]);
    expect(unequal.status).toBe("unmet");
    expect(unequal.remedy).toMatch(/Welch/);
  });

  // There is no statistic for it, and silence would read as "checked".
  it("independence is always present and always says who must answer it", () => {
    const check = independence();
    expect(check.status).toBe("not_assessable");
    expect(check.remedy).toMatch(/methodology/);
    const justified = independence({ justified: "Each respondent completed the survey once." });
    expect(justified.detail).toMatch(/completed the survey once/);
    expect(justified.remedy).toBeUndefined();
  });
});

// Two false positives found by these tests, kept as fixtures because both are
// the kind that make a guard get ignored rather than obeyed.
describe("what the guard must not refuse", () => {
  const correlational: Design = { kind: "correlational", randomised: false };

  // "lower wellbeing" is an adjective. Refusing it rejected the association
  // wording the guard exists to steer people towards.
  it.each([
    "was associated with lower wellbeing",
    "reported higher trust and lower engagement",
    "an increase in reported anxiety was observed alongside it",
    "the decrease was concentrated in the second cohort",
  ])("passes the adjective and noun forms: %s", (prose) => {
    expect(checkCausalClaim(prose, correlational).ok).toBe(true);
  });

  it.each([
    "screen time increased anxiety",
    "the policy reduced attendance",
    "the campaign improved recall",
  ])("still refuses the verb forms: %s", (prose) => {
    expect(checkCausalClaim(prose, correlational).ok).toBe(false);
  });
});

describe("perfectly equal variances are a result, not a failure", () => {
  // F = 0 returned NaN, so "the assumption holds exactly" was indistinguishable
  // from "the check could not run" — and was reported as a violation.
  it("reads identical spreads as homogeneous", () => {
    const check = homogeneityOfVariance([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]]);
    expect(check.status).toBe("met");
    expect(check.detail).toMatch(/p = 1\.000/);
  });
});
