// The assumption checks §7 requires: normality, homogeneity of variance,
// independence.
//
// Reported, never assumed, and — the part that matters — **never blocking**. An
// unmet assumption is a finding about the data, not an error. A tool that
// refused to run a t-test on skewed data would be overruling a decision that
// belongs to the researcher and their supervisor, and they would go and run it
// in SPSS without the note attached. So every check returns something to print
// beside the result, and one of them returns `not_assessable`, which is the
// honest answer more often than either of the other two.

import { describe, clean } from "./describe.ts";
import { chiSquareP, fP, normalP } from "./distributions.ts";
import type { AssumptionCheck } from "./result.ts";

/**
 * D'Agostino–Pearson K², the omnibus normality test.
 *
 * Not Shapiro–Wilk, which is the one a supervisor will ask for. Shapiro–Wilk
 * needs a table of coefficients and a polynomial approximation per sample size,
 * and an implementation of it that is subtly wrong is worse than an honest
 * alternative — this is a repository whose whole argument is that a number
 * nobody can check is a number nobody should trust. K² is computable from the
 * skew and kurtosis already in the descriptives, is what `scipy.stats.normaltest`
 * runs, and the report names it so nobody assumes otherwise.
 *
 * It needs n ≥ 20 to mean anything, and says so below that rather than
 * returning a p-value it cannot support.
 */
export function normality(values: readonly unknown[]): AssumptionCheck {
  const stats = describe(values);
  if (!stats) {
    return { name: "Normality", status: "not_assessable", detail: "Too few observations to assess." };
  }
  const { n, skewness, kurtosis } = stats;

  if (n < 20) {
    return {
      name: "Normality",
      status: "not_assessable",
      // The honest answer. With n this small the test has almost no power, so
      // "met" would mean "we could not have detected a violation" dressed up
      // as reassurance.
      detail: `n = ${n}. Below about 20 observations a normality test cannot detect a violation, so this is unknown rather than satisfied.`,
      remedy: "Judge it from a plot, or use a procedure that does not assume normality.",
    };
  }

  // Transformed skew, D'Agostino (1970).
  const y = skewness * Math.sqrt(((n + 1) * (n + 3)) / (6 * (n - 2)));
  const beta2 =
    (3 * (n * n + 27 * n - 70) * (n + 1) * (n + 3)) /
    ((n - 2) * (n + 5) * (n + 7) * (n + 9));
  const w2 = -1 + Math.sqrt(2 * (beta2 - 1));
  const delta = 1 / Math.sqrt(0.5 * Math.log(w2));
  const alpha = Math.sqrt(2 / (w2 - 1));
  const zSkew = delta * Math.log(y / alpha + Math.sqrt((y / alpha) ** 2 + 1));

  // Transformed kurtosis, Anscombe & Glynn (1983).
  const meanK = (3 * (n - 1)) / (n + 1);
  const varK = (24 * n * (n - 2) * (n - 3)) / ((n + 1) ** 2 * (n + 3) * (n + 5));
  const b2 = kurtosis + 3;
  const x = (b2 - meanK) / Math.sqrt(varK);
  const sqrtBeta1 =
    ((6 * (n * n - 5 * n + 2)) / ((n + 7) * (n + 9))) *
    Math.sqrt((6 * (n + 3) * (n + 5)) / (n * (n - 2) * (n - 3)));
  const a = 6 + (8 / sqrtBeta1) * (2 / sqrtBeta1 + Math.sqrt(1 + 4 / (sqrtBeta1 * sqrtBeta1)));
  const zKurt =
    (1 - 2 / (9 * a) - ((1 - 2 / a) / (1 + x * Math.sqrt(2 / (a - 4)))) ** (1 / 3)) /
    Math.sqrt(2 / (9 * a));

  const k2 = zSkew * zSkew + zKurt * zKurt;
  const p = chiSquareP(k2, 2);
  const met = p >= 0.05;

  return {
    name: "Normality",
    status: met ? "met" : "unmet",
    detail: met
      ? `D'Agostino–Pearson K² = ${k2.toFixed(2)}, p = ${p.toFixed(3)}. No departure from normality was detected (n = ${n}, skew ${skewness.toFixed(2)}, excess kurtosis ${kurtosis.toFixed(2)}).`
      : `D'Agostino–Pearson K² = ${k2.toFixed(2)}, p = ${p.toFixed(3)}. The distribution departs from normal (n = ${n}, skew ${skewness.toFixed(2)}, excess kurtosis ${kurtosis.toFixed(2)}).`,
    ...(met
      ? {}
      : {
          remedy:
            n >= 30
              ? "With this n the mean's sampling distribution is usually robust to it; a rank-based test is the conservative alternative."
              : "Consider a rank-based alternative — Mann–Whitney or Wilcoxon — or a transformation, stated in the methodology.",
        }),
  };
}

/**
 * Levene's test on the median (Brown–Forsythe), for equality of variance.
 *
 * On the median rather than the mean: the mean-centred version is itself
 * sensitive to non-normality, so on skewed data it reports unequal variance
 * that is not there — a test whose assumption violation is the thing it is
 * being used to check for.
 */
export function homogeneityOfVariance(groups: readonly (readonly unknown[])[]): AssumptionCheck {
  const cleaned = groups.map((group) => clean(group).values).filter((group) => group.length >= 2);
  if (cleaned.length < 2) {
    return {
      name: "Homogeneity of variance",
      status: "not_assessable",
      detail: "Needs at least two groups with two or more observations each.",
    };
  }

  const k = cleaned.length;
  const n = cleaned.reduce((sum, group) => sum + group.length, 0);
  const deviations = cleaned.map((group) => {
    const sorted = [...group].sort((a, b) => a - b);
    const median = sorted.length % 2 === 1
      ? sorted[(sorted.length - 1) / 2]!
      : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
    return group.map((value) => Math.abs(value - median));
  });

  const groupMeans = deviations.map((z) => z.reduce((s, v) => s + v, 0) / z.length);
  const grandMean = deviations.flat().reduce((s, v) => s + v, 0) / n;
  const between = deviations.reduce(
    (sum, z, index) => sum + z.length * (groupMeans[index]! - grandMean) ** 2,
    0,
  );
  const within = deviations.reduce(
    (sum, z, index) => sum + z.reduce((s, v) => s + (v - groupMeans[index]!) ** 2, 0),
    0,
  );
  if (within === 0) {
    return {
      name: "Homogeneity of variance",
      status: "not_assessable",
      detail: "Every value within each group is identical, so there is no variance to compare.",
    };
  }

  const w = ((n - k) / (k - 1)) * (between / within);
  const p = fP(w, k - 1, n - k);
  const met = p >= 0.05;

  return {
    name: "Homogeneity of variance",
    status: met ? "met" : "unmet",
    detail: `Levene's test on the median: W(${k - 1}, ${n - k}) = ${w.toFixed(2)}, p = ${p.toFixed(3)}. ${
      met ? "Group variances are comparable." : "Group variances differ."
    }`,
    ...(met ? {} : { remedy: "Welch's correction does not assume equal variance and is reported by default here." }),
  };
}

/**
 * Independence, which is declared rather than tested.
 *
 * There is no statistic for it. Independence is a fact about how the data were
 * collected — whether the same person answered twice, whether pupils are
 * nested in classes, whether the same participant appears in both groups — and
 * a tool that stayed silent would let a researcher infer it had been checked.
 * So it is always present in the list, always `not_assessable`, and always
 * says who has to answer it.
 */
export function independence(design?: { justified?: string }): AssumptionCheck {
  return {
    name: "Independence of observations",
    status: "not_assessable",
    detail: design?.justified?.trim()
      ? `Not testable from the data. Stated in the design: ${design.justified.trim()}`
      : "Not testable from the data — it is a fact about how the data were collected, and no statistic can recover it.",
    remedy: design?.justified?.trim()
      ? undefined
      : "Say in the methodology why observations are independent. If participants are nested — in classes, clinics, households — or measured more than once, this procedure is the wrong one.",
  };
}

/** Variance inflation, for a regression's predictors. */
export function multicollinearity(vifByPredictor: Readonly<Record<string, number>>): AssumptionCheck {
  const entries = Object.entries(vifByPredictor);
  if (entries.length === 0) {
    return { name: "Multicollinearity", status: "not_assessable", detail: "No predictors given." };
  }
  // 10 is the usual threshold and 5 the cautious one. Both are conventions
  // rather than findings, so the number is printed and the reader decides.
  const worst = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const met = worst[1] < 10;
  return {
    name: "Multicollinearity",
    status: met ? "met" : "unmet",
    detail: `Highest variance inflation factor: ${worst[0]} at ${worst[1].toFixed(2)}. The conventional thresholds are 5 for caution and 10 for concern; both are conventions, not findings.`,
    ...(met ? {} : { remedy: "Two predictors are carrying much the same information. Drop one, combine them, or say why both are kept." }),
  };
}

/** The z for a two-tailed normal test, exported for the tests' own use. */
export { normalP };
