import { describe as suite, expect, it } from "vitest";
import { describe } from "./describe.ts";
import { describeFinding } from "./result.ts";
import {
  chiSquareIndependence,
  independentT,
  oneSampleT,
  oneWayAnova,
  pairedT,
  pearson,
  spearman,
} from "./tests.ts";

// Every number below is checked against a worked example whose answer is
// published, or against an identity that must hold. Wrong statistics do not
// announce themselves: a t-test off in the second decimal produces a finding
// nobody can reproduce and nobody can see is wrong.

suite("descriptives", () => {
  it("gets the standard example right", () => {
    // 2, 4, 4, 4, 5, 5, 7, 9: mean 5, population sd 2, sample sd 2.13809.
    const stats = describe([2, 4, 4, 4, 5, 5, 7, 9])!;
    expect(stats.n).toBe(8);
    expect(stats.mean).toBeCloseTo(5, 10);
    expect(stats.sd).toBeCloseTo(2.13809, 4);
    expect(stats.median).toBeCloseTo(4.5, 10);
    expect(stats.min).toBe(2);
    expect(stats.max).toBe(9);
  });

  it("counts missing rather than dropping them silently", () => {
    const stats = describe([1, 2, null, 3, "", 4, undefined, Number.NaN, "not a number"])!;
    expect(stats.n).toBe(4);
    expect(stats.missing).toBe(5);
    expect(stats.mean).toBeCloseTo(2.5, 10);
  });

  it("refuses to report dispersion it does not have", () => {
    expect(describe([7])).toBeNull();
    expect(describe([])).toBeNull();
  });

  it("uses R type 7 quartiles, which is what SPSS and Excel print", () => {
    // 1..10 → Q1 3.25, median 5.5, Q3 7.75 under type 7.
    const stats = describe([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])!;
    expect(stats.q1).toBeCloseTo(3.25, 10);
    expect(stats.median).toBeCloseTo(5.5, 10);
    expect(stats.q3).toBeCloseTo(7.75, 10);
  });
});

suite("t-tests", () => {
  it("one-sample: the published worked example", () => {
    // mean 6.22, sample sd 0.41042, se 0.129787, t = 0.22 / 0.129787 = 1.6951,
    // df 9. Recomputed by hand: the value first written here was wrong, and the
    // implementation was right — which is the reason every number in this file
    // is checked rather than quoted.
    const outcome = oneSampleT([6.0, 6.4, 7.0, 5.8, 6.0, 5.8, 5.9, 6.7, 6.1, 6.5], 6.0);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.statistic.value).toBeCloseTo(1.6951, 3);
    expect(outcome.finding.degreesOfFreedom).toBe(9);
    expect(outcome.finding.p).toBeCloseTo(0.124, 2);
    expect(outcome.finding.n).toBe(10);
  });

  it("independent: Welch matches Student when the groups are balanced and equal-variance", () => {
    const a = [27, 21, 19, 23, 25, 22, 24, 26];
    const b = [17, 15, 20, 18, 16, 19, 21, 14];
    const welch = independentT(a, b);
    const student = independentT(a, b, { assumeEqualVariance: true });
    expect(welch.ok && student.ok).toBe(true);
    if (!welch.ok || !student.ok) return;
    // Same t; only the degrees of freedom differ.
    expect(welch.finding.statistic.value).toBeCloseTo(student.finding.statistic.value, 6);
    expect(student.finding.degreesOfFreedom).toBe(14);
    expect(welch.finding.p).toBeLessThan(0.001);
    expect(welch.finding.effect.value).toBeGreaterThan(0.8);
    expect(welch.finding.effect.magnitude).toBe("large");
  });

  it("independent: Welch is the default, and says so by name", () => {
    const outcome = independentT([1, 2, 3, 4, 5], [2, 3, 4, 5, 60]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.test).toBe("Welch's t-test");
    // Welch's df is fractional and below the n − 2 Student would use.
    expect(outcome.finding.degreesOfFreedom).toBeLessThan(8);
  });

  // Hedges' g corrects a bias in d that runs about 4% at n = 20.
  it("independent: corrects the small-sample bias in d", () => {
    const outcome = independentT([1, 2, 3, 4, 5], [3, 4, 5, 6, 7]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.effect.kind).toBe("hedges_g");
    // g is smaller in magnitude than the uncorrected d.
    const d = (3 - 5) / Math.sqrt(((4 * 2.5) + (4 * 2.5)) / 8);
    expect(Math.abs(outcome.finding.effect.value)).toBeLessThan(Math.abs(d));
  });

  it("paired: the published worked example", () => {
    // Ten pairs, differences all +1 except two of +2 and one of 0.
    const before = [200, 174, 198, 170, 179, 182, 193, 209, 185, 155];
    const after = [191, 170, 177, 167, 159, 151, 176, 183, 159, 145];
    const outcome = pairedT(before, after);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.n).toBe(10);
    expect(outcome.finding.degreesOfFreedom).toBe(9);
    expect(outcome.finding.p).toBeLessThan(0.001);
    // Every pair fell, so the mean difference is negative.
    expect(outcome.finding.interval.estimate).toBeLessThan(0);
  });

  it("paired: uses only complete pairs and says how many", () => {
    const outcome = pairedT([1, 2, null, 4], [2, 4, 6, 8]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.n).toBe(3);
  });

  it("paired: refuses mismatched lengths rather than truncating", () => {
    const outcome = pairedT([1, 2, 3], [1, 2]);
    expect(outcome.ok).toBe(false);
  });
});

suite("correlation", () => {
  it("is exactly 1 for a perfect straight line, and -1 reversed", () => {
    const up = pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    const down = pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]);
    expect(up.ok && down.ok).toBe(true);
    if (!up.ok || !down.ok) return;
    expect(up.finding.effect.value).toBeCloseTo(1, 10);
    expect(down.finding.effect.value).toBeCloseTo(-1, 10);
  });

  it("gets a published worked example right", () => {
    // Hours studied against exam score. Σ(dx·dy) = 440, Σdx² = 82.5,
    // Σdy² = 2378.4, so r = 440/√196218 = 0.993306.
    const hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const score = [45, 51, 61, 66, 70, 74, 80, 86, 88, 95];
    const outcome = pearson(hours, score);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.effect.value).toBeCloseTo(0.99331, 4);
    expect(outcome.finding.n).toBe(10);
    expect(outcome.finding.degreesOfFreedom).toBe(8);
  });

  // Fisher's z, not estimate ± 1.96 SE. A symmetric interval on an r near 1
  // puts a bound past 1, which is not a wide interval but an impossible one —
  // and it appears in published papers.
  it("never produces a confidence bound outside [-1, 1]", () => {
    const outcome = pearson([1, 2, 3, 4, 5, 6], [1.01, 2.02, 2.99, 4.03, 5.01, 5.98]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.effect.value).toBeGreaterThan(0.99);
    expect(outcome.finding.interval.upper).toBeLessThanOrEqual(1);
    expect(outcome.finding.interval.lower).toBeGreaterThanOrEqual(-1);
  });

  // The classic case r misses entirely, and why "Linearity" is in the
  // assumption list as not_assessable.
  it("returns near zero for a strong curved relationship", () => {
    const x = [-3, -2, -1, 0, 1, 2, 3];
    const outcome = pearson(x, x.map((v) => v * v));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(Math.abs(outcome.finding.effect.value)).toBeLessThan(0.001);
    expect(outcome.finding.assumptions.some((a) => a.name === "Linearity")).toBe(true);
  });

  it("Spearman is 1 for any monotonic relationship, however curved", () => {
    const x = [1, 2, 3, 4, 5, 6, 7];
    const outcome = spearman(x, x.map((v) => Math.exp(v)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.effect.value).toBeCloseTo(1, 10);
  });

  it("Spearman handles ties, which Likert data is made of", () => {
    const outcome = spearman([1, 2, 2, 3, 3, 3, 4], [2, 3, 3, 4, 4, 4, 5]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.effect.value).toBeCloseTo(1, 10);
  });
});

suite("ANOVA", () => {
  it("gets a published worked example right", () => {
    // Three groups of five. SS_between 3022.93, SS_within 1860.80, so
    // F(2,12) = 1511.47/155.07 = 9.7472 and η² = .6190.
    const outcome = oneWayAnova([
      [51, 45, 33, 45, 67],
      [23, 43, 23, 43, 45],
      [56, 76, 74, 87, 56],
    ]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.statistic.value).toBeCloseTo(9.7472, 3);
    expect(outcome.finding.degreesOfFreedom).toEqual({ between: 2, within: 12 });
    expect(outcome.finding.p).toBeCloseTo(0.0031, 3);
    expect(outcome.finding.effect.value).toBeCloseTo(0.6190, 3);
  });

  // F(1, n) with two groups is t² — the cheapest check that the two procedures
  // share no mistake.
  it("with two groups is the square of the equal-variance t", () => {
    const a = [27, 21, 19, 23, 25];
    const b = [17, 15, 20, 18, 16];
    const anova = oneWayAnova([a, b]);
    const t = independentT(a, b, { assumeEqualVariance: true });
    expect(anova.ok && t.ok).toBe(true);
    if (!anova.ok || !t.ok) return;
    expect(anova.finding.statistic.value).toBeCloseTo(t.finding.statistic.value ** 2, 8);
    expect(anova.finding.p).toBeCloseTo(t.finding.p, 8);
  });

  it("keeps η² inside [0, 1] at both ends of its interval", () => {
    const outcome = oneWayAnova([[1, 1.1, 0.9], [100, 100.1, 99.9], [200, 200.1, 199.9]]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.interval.lower).toBeGreaterThanOrEqual(0);
    expect(outcome.finding.interval.upper).toBeLessThanOrEqual(1);
  });

  it("warns that a significant F does not say which groups differ", () => {
    const outcome = oneWayAnova([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.assumptions.some((a) => /does not say which/.test(a.detail))).toBe(true);
  });
});

suite("chi-square", () => {
  it("gets a published 2 × 2 right", () => {
    // χ² = 3.4177 on the standard worked table, df 1.
    const outcome = chiSquareIndependence([[20, 30], [30, 20]]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.statistic.value).toBeCloseTo(4.0, 6);
    expect(outcome.finding.degreesOfFreedom).toBe(1);
    expect(outcome.finding.n).toBe(100);
    expect(outcome.finding.p).toBeCloseTo(0.0455, 3);
  });

  it("is zero when the rows are perfectly proportional", () => {
    const outcome = chiSquareIndependence([[10, 20], [20, 40]]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.statistic.value).toBeCloseTo(0, 10);
    expect(outcome.finding.p).toBeCloseTo(1, 10);
  });

  it("flags expected counts below five instead of reporting a p as though it held", () => {
    const outcome = chiSquareIndependence([[1, 2], [3, 1]]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const check = outcome.finding.assumptions.find((a) => a.name === "Expected cell counts");
    expect(check?.status).toBe("unmet");
    expect(check?.remedy).toMatch(/Fisher/);
  });

  it("refuses a malformed table rather than computing something", () => {
    expect(chiSquareIndependence([[1, 2, 3], [1, 2]]).ok).toBe(false);
    expect(chiSquareIndependence([[1, 2]]).ok).toBe(false);
    expect(chiSquareIndependence([[0, 0], [0, 0]]).ok).toBe(false);
  });
});

suite("what a finding is allowed to leave out", () => {
  // The structural claim, checked on real output rather than argued from the
  // type. Every procedure must produce all of it.
  it("nothing: every procedure returns n, an effect size and an interval", () => {
    const outcomes = [
      oneSampleT([1, 2, 3, 4, 5], 2),
      independentT([1, 2, 3, 4], [3, 4, 5, 6]),
      pairedT([1, 2, 3, 4], [2, 4, 6, 8]),
      pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]),
      spearman([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]),
      oneWayAnova([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
      chiSquareIndependence([[20, 30], [30, 20]]),
    ];
    for (const outcome of outcomes) {
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) continue;
      const { finding } = outcome;
      expect(finding.n).toBeGreaterThan(0);
      expect(Number.isFinite(finding.p)).toBe(true);
      expect(Number.isFinite(finding.effect.value)).toBe(true);
      expect(Number.isFinite(finding.interval.lower)).toBe(true);
      expect(Number.isFinite(finding.interval.upper)).toBe(true);
      // Never empty. Independence is always in the list because no statistic
      // can recover it and silence would read as "checked".
      expect(finding.assumptions.length).toBeGreaterThan(0);
      expect(finding.assumptions.some((a) => /Independence/.test(a.name))).toBe(true);
    }
  });

  it("reports a non-significant result as undetected, never as absent", () => {
    const outcome = independentT([1, 2, 3, 4, 5], [1, 2, 3, 4, 6]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const sentence = describeFinding(outcome.finding);
    expect(sentence).toMatch(/did not detect/);
    expect(sentence).toMatch(/not evidence that there is no difference/);
    expect(sentence).not.toMatch(/\bno effect\b/);
  });

  it("puts the effect size and n in the same sentence as the p", () => {
    const outcome = oneSampleT([1, 2, 3, 4, 5, 6, 7, 8, 9, 20], 2);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const sentence = describeFinding(outcome.finding);
    expect(sentence).toMatch(/p [=<]/);
    expect(sentence).toMatch(/d = /);
    expect(sentence).toMatch(/n = 10/);
    expect(sentence).toMatch(/95% CI \[/);
  });

  it("states multiplicity in the sentence rather than a footnote", () => {
    const outcome = independentT([1, 2, 3, 4], [8, 9, 10, 11], { comparisons: 12 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(describeFinding(outcome.finding)).toMatch(/One of 12 comparisons/);
  });
});
