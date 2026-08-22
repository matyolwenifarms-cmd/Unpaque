// The procedures §7 names, each returning a whole Finding.
//
// There is no function here that returns a p-value. Every one returns a
// `Finding`, which cannot be built without n, an effect size and an interval —
// so "report the p and work the rest out later" is not a shortcut available to
// a caller. See result.ts.
//
// Welch's t-test is the default for two independent groups, not Student's.
// Student's assumes equal variance, that assumption is usually untested, and
// Welch is very slightly less powerful when it holds and much better behaved
// when it does not. It is what statisticians recommend as the routine choice
// and what most textbooks still teach second.

import { clean, describe, ranks } from "./describe.ts";
import { chiSquareP, fP, studentP } from "./distributions.ts";
import { homogeneityOfVariance, independence, normality } from "./assumptions.ts";
import {
  correlationInterval,
  magnitudeOf,
  meanInterval,
  type AssumptionCheck,
  type Finding,
} from "./result.ts";

export type TestOutcome =
  | { ok: true; finding: Finding }
  | { ok: false; reason: string };

export interface TestOptions {
  /** How many tests are in this family. Travels onto the finding. */
  comparisons?: number;
  /** What the design says about independence, if anything. */
  independenceJustified?: string;
  level?: number;
}

/** One sample against a hypothesised value. */
export function oneSampleT(
  values: readonly unknown[],
  mu: number,
  options: TestOptions = {},
): TestOutcome {
  const stats = describe(values);
  if (!stats) return { ok: false, reason: "Fewer than two usable observations." };
  if (stats.sd === 0) return { ok: false, reason: "Every observation is identical, so there is no variance to test." };

  const df = stats.n - 1;
  const t = (stats.mean - mu) / stats.se;
  const p = studentP(t, df);
  // Cohen's d for one sample: the mean difference in standard deviations.
  const d = (stats.mean - mu) / stats.sd;

  return {
    ok: true,
    finding: {
      test: "One-sample t-test",
      statistic: { symbol: "t", value: t },
      degreesOfFreedom: df,
      p,
      n: stats.n,
      effect: { kind: "cohens_d", value: d, magnitude: magnitudeOf("cohens_d", d) },
      interval: meanInterval(stats.mean - mu, stats.se, df, options.level ?? 0.95),
      comparisons: options.comparisons ?? 1,
      assumptions: [normality(values), independence({ justified: options.independenceJustified })],
    },
  };
}

/** Two independent groups. Welch by default; see the module note. */
export function independentT(
  a: readonly unknown[],
  b: readonly unknown[],
  options: TestOptions & { assumeEqualVariance?: boolean } = {},
): TestOutcome {
  const groupA = describe(a);
  const groupB = describe(b);
  if (!groupA || !groupB) return { ok: false, reason: "Each group needs at least two usable observations." };
  if (groupA.sd === 0 && groupB.sd === 0) {
    return { ok: false, reason: "Neither group varies, so there is no variance to test." };
  }

  const varA = groupA.sd ** 2;
  const varB = groupB.sd ** 2;
  const difference = groupA.mean - groupB.mean;

  let se: number;
  let df: number;
  let name: string;

  if (options.assumeEqualVariance) {
    const pooledVar =
      ((groupA.n - 1) * varA + (groupB.n - 1) * varB) / (groupA.n + groupB.n - 2);
    se = Math.sqrt(pooledVar * (1 / groupA.n + 1 / groupB.n));
    df = groupA.n + groupB.n - 2;
    name = "Independent-samples t-test";
  } else {
    se = Math.sqrt(varA / groupA.n + varB / groupB.n);
    // Welch–Satterthwaite.
    df =
      (varA / groupA.n + varB / groupB.n) ** 2 /
      ((varA / groupA.n) ** 2 / (groupA.n - 1) + (varB / groupB.n) ** 2 / (groupB.n - 1));
    name = "Welch's t-test";
  }

  const t = difference / se;
  const p = studentP(t, df);

  // Hedges' g rather than Cohen's d: d is biased upward on small samples, by
  // about 4% at n = 20, and the correction costs one multiplication.
  const pooledSd = Math.sqrt(
    ((groupA.n - 1) * varA + (groupB.n - 1) * varB) / (groupA.n + groupB.n - 2),
  );
  const d = difference / pooledSd;
  const totalN = groupA.n + groupB.n;
  const correction = 1 - 3 / (4 * (totalN - 2) - 1);
  const g = d * correction;

  return {
    ok: true,
    finding: {
      test: name,
      statistic: { symbol: "t", value: t },
      degreesOfFreedom: df,
      p,
      n: totalN,
      effect: { kind: "hedges_g", value: g, magnitude: magnitudeOf("hedges_g", g) },
      interval: meanInterval(difference, se, df, options.level ?? 0.95),
      comparisons: options.comparisons ?? 1,
      assumptions: [
        normality(a),
        normality(b),
        homogeneityOfVariance([a, b]),
        independence({ justified: options.independenceJustified }),
      ],
    },
  };
}

/** The same people measured twice. */
export function pairedT(
  before: readonly unknown[],
  after: readonly unknown[],
  options: TestOptions = {},
): TestOutcome {
  if (before.length !== after.length) {
    return { ok: false, reason: "A paired test needs the same number of observations in both conditions." };
  }
  // Pairwise deletion: a pair is usable only if both halves are.
  //
  // Through `usable`, not `Number()`. `Number(null)` is 0 and `Number("")` is
  // 0, both finite — so a bare Number() check silently treats every blank cell
  // as a real zero and computes a difference from it. On a before/after design
  // that turns a dropout into a participant whose score fell to nothing, which
  // moves the mean in the direction the researcher was hoping for.
  const differences: number[] = [];
  for (let i = 0; i < before.length; i += 1) {
    const x = usable(before[i]);
    const y = usable(after[i]);
    if (x !== null && y !== null) differences.push(y - x);
  }
  const stats = describe(differences);
  if (!stats) return { ok: false, reason: "Fewer than two complete pairs." };
  if (stats.sd === 0) return { ok: false, reason: "Every pair changed by the same amount, so there is no variance to test." };

  const df = stats.n - 1;
  const t = stats.mean / stats.se;
  const p = studentP(t, df);
  const d = stats.mean / stats.sd;

  return {
    ok: true,
    finding: {
      test: "Paired-samples t-test",
      statistic: { symbol: "t", value: t },
      degreesOfFreedom: df,
      p,
      n: stats.n,
      effect: { kind: "cohens_d", value: d, magnitude: magnitudeOf("cohens_d", d) },
      interval: meanInterval(stats.mean, stats.se, df, options.level ?? 0.95),
      comparisons: options.comparisons ?? 1,
      assumptions: [
        // Normality of the *differences*, which is the assumption a paired
        // test actually makes — not of either condition.
        { ...normality(differences), name: "Normality of the differences" },
        // Independence is between pairs; within a pair, dependence is the design.
        {
          ...independence({ justified: options.independenceJustified }),
          name: "Independence between pairs",
        },
      ],
    },
  };
}

/** Pearson's r. */
export function pearson(
  x: readonly unknown[],
  y: readonly unknown[],
  options: TestOptions = {},
): TestOutcome {
  const pairs = completePairs(x, y);
  if (pairs.length < 3) return { ok: false, reason: "Fewer than three complete pairs." };
  const r = pearsonR(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
  if (!Number.isFinite(r)) return { ok: false, reason: "One of the variables does not vary." };

  const n = pairs.length;
  const df = n - 2;
  const t = r * Math.sqrt(df / (1 - r * r));
  const p = studentP(t, df);

  return {
    ok: true,
    finding: {
      test: "Pearson correlation",
      statistic: { symbol: "t", value: t },
      degreesOfFreedom: df,
      p,
      n,
      effect: { kind: "pearson_r", value: r, magnitude: magnitudeOf("pearson_r", r) },
      interval: correlationInterval(r, n, options.level ?? 0.95),
      comparisons: options.comparisons ?? 1,
      assumptions: [
        normality(pairs.map((pair) => pair[0])),
        normality(pairs.map((pair) => pair[1])),
        {
          name: "Linearity",
          status: "not_assessable",
          detail:
            "r measures straight-line association only. A strong curved relationship can produce an r near zero, and no statistic here can tell the difference.",
          remedy: "Look at the scatterplot before reporting this.",
        },
        independence({ justified: options.independenceJustified }),
      ],
    },
  };
}

/** Spearman's ρ, for ranks or where linearity does not hold. */
export function spearman(
  x: readonly unknown[],
  y: readonly unknown[],
  options: TestOptions = {},
): TestOutcome {
  const pairs = completePairs(x, y);
  if (pairs.length < 3) return { ok: false, reason: "Fewer than three complete pairs." };
  const rankX = ranks(pairs.map((pair) => pair[0]));
  const rankY = ranks(pairs.map((pair) => pair[1]));
  // Pearson on the ranks, which handles ties correctly where the 6Σd² shortcut
  // does not — and ties are the norm on Likert data, which is most of this.
  const rho = pearsonR(rankX, rankY);
  if (!Number.isFinite(rho)) return { ok: false, reason: "One of the variables does not vary." };

  const n = pairs.length;
  const df = n - 2;
  const t = rho * Math.sqrt(df / (1 - rho * rho));

  return {
    ok: true,
    finding: {
      test: "Spearman rank correlation",
      statistic: { symbol: "t", value: t },
      degreesOfFreedom: df,
      p: studentP(t, df),
      n,
      effect: { kind: "spearman_rho", value: rho, magnitude: magnitudeOf("spearman_rho", rho) },
      interval: correlationInterval(rho, n, options.level ?? 0.95),
      comparisons: options.comparisons ?? 1,
      assumptions: [
        {
          name: "Monotonicity",
          status: "not_assessable",
          detail: "ρ measures whether the relationship is consistently increasing or decreasing, not whether it is a straight line.",
        },
        independence({ justified: options.independenceJustified }),
      ],
    },
  };
}

/** One-way ANOVA across three or more groups. */
export function oneWayAnova(
  groups: readonly (readonly unknown[])[],
  options: TestOptions = {},
): TestOutcome {
  const cleaned = groups.map((group) => clean(group).values).filter((group) => group.length >= 2);
  if (cleaned.length < 2) return { ok: false, reason: "Needs at least two groups with two or more observations each." };

  const k = cleaned.length;
  const n = cleaned.reduce((sum, group) => sum + group.length, 0);
  const grandMean = cleaned.flat().reduce((sum, value) => sum + value, 0) / n;
  const means = cleaned.map((group) => group.reduce((s, v) => s + v, 0) / group.length);

  const ssBetween = cleaned.reduce(
    (sum, group, index) => sum + group.length * (means[index]! - grandMean) ** 2,
    0,
  );
  const ssWithin = cleaned.reduce(
    (sum, group, index) => sum + group.reduce((s, v) => s + (v - means[index]!) ** 2, 0),
    0,
  );
  if (ssWithin === 0) return { ok: false, reason: "There is no variation within the groups." };

  const dfBetween = k - 1;
  const dfWithin = n - k;
  const f = (ssBetween / dfBetween) / (ssWithin / dfWithin);
  const p = fP(f, dfBetween, dfWithin);
  const etaSquared = ssBetween / (ssBetween + ssWithin);

  // The interval is around η², by the standard large-sample approximation.
  // Bounded to [0, 1] because a proportion of variance cannot leave it, and an
  // interval that says -0.04 is a rendering somebody has to explain away.
  const seEta = Math.sqrt((4 * etaSquared * (1 - etaSquared) ** 2) / n);
  const lower = Math.max(0, etaSquared - 1.96 * seEta);
  const upper = Math.min(1, etaSquared + 1.96 * seEta);

  return {
    ok: true,
    finding: {
      test: "One-way ANOVA",
      statistic: { symbol: "F", value: f },
      degreesOfFreedom: { between: dfBetween, within: dfWithin },
      p,
      n,
      effect: { kind: "eta_squared", value: etaSquared, magnitude: magnitudeOf("eta_squared", etaSquared) },
      interval: { estimate: etaSquared, lower, upper, level: options.level ?? 0.95 },
      comparisons: options.comparisons ?? 1,
      assumptions: [
        ...cleaned.map((group, index) => ({
          ...normality(group),
          name: `Normality, group ${index + 1}`,
        })),
        homogeneityOfVariance(groups),
        independence({ justified: options.independenceJustified }),
        {
          name: "What a significant F does and does not say",
          status: "not_assessable" as const,
          detail: "F says at least two groups differ. It does not say which, and reading the means to find out is a comparison that needs counting.",
          remedy: "Run the pairwise comparisons explicitly and correct for their number.",
        },
      ],
    },
  };
}

/** Chi-square test of independence on a contingency table. */
export function chiSquareIndependence(
  table: readonly (readonly number[])[],
  options: TestOptions = {},
): TestOutcome {
  const rows = table.length;
  const columns = table[0]?.length ?? 0;
  if (rows < 2 || columns < 2) return { ok: false, reason: "Needs a table of at least 2 × 2." };
  if (table.some((row) => row.length !== columns)) return { ok: false, reason: "The table's rows are not the same length." };

  const rowTotals = table.map((row) => row.reduce((s, v) => s + v, 0));
  const columnTotals = Array.from({ length: columns }, (_, c) =>
    table.reduce((s, row) => s + row[c]!, 0));
  const n = rowTotals.reduce((s, v) => s + v, 0);
  if (n === 0) return { ok: false, reason: "The table is empty." };

  let chiSquare = 0;
  let smallestExpected = Infinity;
  let cellsUnderFive = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      const expected = (rowTotals[r]! * columnTotals[c]!) / n;
      if (expected === 0) return { ok: false, reason: "A row or column total is zero." };
      smallestExpected = Math.min(smallestExpected, expected);
      if (expected < 5) cellsUnderFive += 1;
      chiSquare += (table[r]![c]! - expected) ** 2 / expected;
    }
  }

  const df = (rows - 1) * (columns - 1);
  const p = chiSquareP(chiSquare, df);
  const v = Math.sqrt(chiSquare / (n * Math.min(rows - 1, columns - 1)));
  const w = Math.sqrt(chiSquare / n);

  // Cramér's V has no distribution-free interval worth printing, so the
  // interval carries w — which does, via the chi-square non-centrality — and
  // the effect stays V because that is what a methods chapter reports.
  const seW = Math.sqrt(1 / n);

  const expectedCheck: AssumptionCheck = cellsUnderFive === 0
    ? {
        name: "Expected cell counts",
        status: "met",
        detail: `Every expected count is at least 5 (smallest ${smallestExpected.toFixed(2)}).`,
      }
    : {
        name: "Expected cell counts",
        status: "unmet",
        detail: `${cellsUnderFive} cell(s) have an expected count below 5 (smallest ${smallestExpected.toFixed(2)}). The chi-square approximation is unreliable here.`,
        remedy: rows === 2 && columns === 2
          ? "Use Fisher's exact test."
          : "Collapse categories that can defensibly be combined, or use an exact test.",
      };

  return {
    ok: true,
    finding: {
      test: "Chi-square test of independence",
      statistic: { symbol: "χ²", value: chiSquare },
      degreesOfFreedom: df,
      p,
      n,
      effect: { kind: "cramers_v", value: v, magnitude: magnitudeOf("cramers_v", v) },
      interval: { estimate: w, lower: Math.max(0, w - 1.96 * seW), upper: w + 1.96 * seW, level: options.level ?? 0.95 },
      comparisons: options.comparisons ?? 1,
      assumptions: [expectedCheck, independence({ justified: options.independenceJustified })],
    },
  };
}

function completePairs(x: readonly unknown[], y: readonly unknown[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  const length = Math.min(x.length, y.length);
  for (let i = 0; i < length; i += 1) {
    const a = usable(x[i]);
    const b = usable(y[i]);
    if (a !== null && b !== null) pairs.push([a, b]);
  }
  return pairs;
}

/**
 * One value, or null if it is missing. The same rule `clean` applies.
 *
 * Its own function because `Number(null)` and `Number("")` are both 0, and
 * every place that forgets it converts absent data into zeros — silently, and
 * always toward a smaller effect or a spurious one depending on the design.
 */
function usable(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function pearsonR(x: readonly number[], y: readonly number[]): number {
  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = x[i]! - meanX;
    const dy = y[i]! - meanY;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return Number.NaN;
  return sxy / Math.sqrt(sxx * syy);
}
