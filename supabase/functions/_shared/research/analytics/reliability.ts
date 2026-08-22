// Cronbach's α and McDonald's ω, for a set of items meant to measure one thing.
//
// α is what a supervisor asks for and ω is what the psychometrics literature
// has been asking people to report instead for twenty years, so both are here
// and the report says what each assumes. α assumes every item loads on the
// construct equally (tau-equivalence); when they do not, which is usually, α
// understates reliability. ω does not assume it.
//
// The trap this module exists to avoid: α rises with the number of items
// whether or not they measure anything. A twenty-item scale of loosely related
// questions will clear .80 on nothing but its length, and "α = .84" then gets
// reported as evidence of a construct. So the item count travels with the
// coefficient, and the interpretation says it.

import { pearsonR } from "./tests.ts";

export interface Reliability {
  coefficient: number;
  kind: "cronbach_alpha" | "mcdonald_omega";
  items: number;
  n: number;
  /** Per-item: what α would be if this item were dropped. */
  alphaIfDropped: Array<{ item: number; alpha: number }>;
  says: string;
}

export type ReliabilityOutcome =
  | { ok: true; reliability: Reliability }
  | { ok: false; reason: string };

/**
 * @param responses One row per respondent, one column per item.
 */
export function cronbachAlpha(responses: readonly (readonly number[])[]): ReliabilityOutcome {
  const complete = responses.filter(
    (row) => row.length > 0 && row.every((value) => Number.isFinite(value)),
  );
  const n = complete.length;
  const k = complete[0]?.length ?? 0;
  if (k < 2) return { ok: false, reason: "Reliability needs at least two items." };
  if (n < 3) return { ok: false, reason: "Reliability needs at least three complete responses." };
  if (complete.some((row) => row.length !== k)) {
    return { ok: false, reason: "Every response must answer the same number of items." };
  }

  const alpha = alphaOf(complete, k, n);
  if (alpha === null) return { ok: false, reason: "Total scores do not vary, so there is nothing to be reliable about." };

  const alphaIfDropped: Array<{ item: number; alpha: number }> = [];
  for (let drop = 0; drop < k; drop += 1) {
    const without = complete.map((row) => row.filter((_, index) => index !== drop));
    const value = k - 1 >= 2 ? alphaOf(without, k - 1, n) : null;
    if (value !== null) alphaIfDropped.push({ item: drop, alpha: value });
  }

  return {
    ok: true,
    reliability: {
      coefficient: alpha,
      kind: "cronbach_alpha",
      items: k,
      n,
      alphaIfDropped,
      says: interpret(alpha, k),
    },
  };
}

function alphaOf(rows: readonly (readonly number[])[], k: number, n: number): number | null {
  const itemVariances: number[] = [];
  for (let item = 0; item < k; item += 1) {
    const column = rows.map((row) => row[item]!);
    const mean = column.reduce((s, v) => s + v, 0) / n;
    itemVariances.push(column.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  }
  const totals = rows.map((row) => row.reduce((s, v) => s + v, 0));
  const totalMean = totals.reduce((s, v) => s + v, 0) / n;
  const totalVariance = totals.reduce((s, v) => s + (v - totalMean) ** 2, 0) / (n - 1);
  if (totalVariance === 0) return null;
  return (k / (k - 1)) * (1 - itemVariances.reduce((s, v) => s + v, 0) / totalVariance);
}

/**
 * McDonald's ω, from a single-factor loading estimate.
 *
 * The loadings come from the first principal component rather than a full
 * maximum-likelihood factor analysis. That is a real simplification and is
 * said out loud in `says`: for a genuinely unidimensional scale the two agree
 * closely, and where they do not, the scale is not unidimensional and ω was
 * the wrong coefficient anyway.
 */
export function mcdonaldOmega(responses: readonly (readonly number[])[]): ReliabilityOutcome {
  const complete = responses.filter(
    (row) => row.length > 0 && row.every((value) => Number.isFinite(value)),
  );
  const n = complete.length;
  const k = complete[0]?.length ?? 0;
  if (k < 3) return { ok: false, reason: "ω needs at least three items to estimate a factor." };
  if (n < 3) return { ok: false, reason: "ω needs at least three complete responses." };

  const columns = Array.from({ length: k }, (_, item) => complete.map((row) => row[item]!));
  const variances = columns.map((column) => {
    const mean = column.reduce((s, v) => s + v, 0) / n;
    return column.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  });
  if (variances.some((v) => v === 0)) {
    return { ok: false, reason: "At least one item has the same answer from everybody." };
  }

  // First principal component of the correlation matrix by power iteration —
  // enough for loadings, and far less machinery than an eigen solver.
  const correlation = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) => (i === j ? 1 : pearsonR(columns[i]!, columns[j]!))));
  if (correlation.some((row) => row.some((value) => !Number.isFinite(value)))) {
    return { ok: false, reason: "Two items could not be correlated." };
  }

  let vector = new Array<number>(k).fill(1 / Math.sqrt(k));
  let eigenvalue = 0;
  for (let iteration = 0; iteration < 500; iteration += 1) {
    const next = correlation.map((row) => row.reduce((s, value, j) => s + value * vector[j]!, 0));
    const norm = Math.sqrt(next.reduce((s, v) => s + v * v, 0));
    if (norm === 0) break;
    const normalised = next.map((v) => v / norm);
    if (normalised.every((v, i) => Math.abs(v - vector[i]!) < 1e-12)) {
      vector = normalised;
      eigenvalue = norm;
      break;
    }
    vector = normalised;
    eigenvalue = norm;
  }

  const loadings = vector.map((v, i) => v * Math.sqrt(eigenvalue) * Math.sqrt(variances[i]!));
  const sumLoadings = loadings.reduce((s, v) => s + v, 0);
  const uniqueness = variances.reduce((s, v, i) => s + Math.max(0, v - loadings[i]! ** 2), 0);
  const omega = sumLoadings ** 2 / (sumLoadings ** 2 + uniqueness);
  if (!Number.isFinite(omega)) return { ok: false, reason: "The factor estimate did not converge." };

  return {
    ok: true,
    reliability: {
      coefficient: omega,
      kind: "mcdonald_omega",
      items: k,
      n,
      alphaIfDropped: [],
      says:
        `${interpret(omega, k)} Estimated from the first principal component rather than a maximum-likelihood factor analysis; for a genuinely one-dimensional scale the two agree closely, and where they do not, the scale is not one-dimensional and ω is the wrong coefficient for it.`,
    },
  };
}

function interpret(coefficient: number, items: number): string {
  const band =
    coefficient >= 0.9 ? "very high" :
    coefficient >= 0.8 ? "good" :
    coefficient >= 0.7 ? "acceptable for research use" :
    coefficient >= 0.6 ? "questionable" : "low";

  const lengthWarning = items >= 15
    ? ` Note the scale has ${items} items: the coefficient rises with length whether or not the items measure one thing, so a high value here is weaker evidence of a construct than the same value on a short scale.`
    : "";

  const ceiling = coefficient >= 0.95
    ? " Above about .95 the items may be near-duplicates of each other rather than of a construct, which is redundancy rather than reliability."
    : "";

  return `${coefficient.toFixed(3)} — ${band}.${lengthWarning}${ceiling}`;
}
