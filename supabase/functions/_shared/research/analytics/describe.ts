// Descriptives, and the missing-data accounting that goes with them.
//
// `n` here is the number of usable observations, never the number of rows. The
// two differ the moment anybody has skipped a question, and a mean reported
// against the row count is wrong by exactly the amount nobody notices. So
// `missing` is a field rather than something the caller works out, and every
// test in this directory takes its n from here.

export interface Descriptives {
  /** Usable observations. */
  n: number;
  /** Values that were absent, blank, or not a finite number. */
  missing: number;
  mean: number;
  /** Sample standard deviation, n − 1 in the denominator. */
  sd: number;
  se: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  skewness: number;
  /** Excess kurtosis: 0 for a normal distribution, not 3. */
  kurtosis: number;
}

/**
 * Keep the finite numbers and count what was dropped.
 *
 * Exported because every procedure needs the same rule, and two places
 * deciding separately what counts as missing is how an n of 96 in one table
 * becomes an n of 98 in the next.
 */
export function clean(values: readonly unknown[]): { values: number[]; missing: number } {
  const kept: number[] = [];
  let missing = 0;
  for (const value of values) {
    const number = typeof value === "number" ? value : Number(value);
    if (value === null || value === undefined || value === "" || !Number.isFinite(number)) {
      missing += 1;
      continue;
    }
    kept.push(number);
  }
  return { values: kept, missing };
}

export function describe(input: readonly unknown[]): Descriptives | null {
  const { values, missing } = clean(input);
  const n = values.length;
  // Two observations is the floor for a sample standard deviation. Below it
  // there is no dispersion to report and returning 0 would be a lie about
  // certainty rather than an admission of ignorance.
  if (n < 2) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const deviations = values.map((value) => value - mean);
  const sumSquares = deviations.reduce((sum, d) => sum + d * d, 0);
  const variance = sumSquares / (n - 1);
  const sd = Math.sqrt(variance);

  // Population moments for skew and kurtosis, then the standard small-sample
  // corrections — the same ones SPSS and R's `moments` report, so a researcher
  // comparing against either sees the same number.
  const m2 = sumSquares / n;
  const m3 = deviations.reduce((sum, d) => sum + d ** 3, 0) / n;
  const m4 = deviations.reduce((sum, d) => sum + d ** 4, 0) / n;
  const g1 = m2 === 0 ? 0 : m3 / m2 ** 1.5;
  const g2 = m2 === 0 ? 0 : m4 / (m2 * m2) - 3;
  const skewness = n > 2 ? (Math.sqrt(n * (n - 1)) / (n - 2)) * g1 : g1;
  const kurtosis =
    n > 3 ? ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * g2 + 6) : g2;

  return {
    n,
    missing,
    mean,
    sd,
    se: sd / Math.sqrt(n),
    min: sorted[0]!,
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[n - 1]!,
    skewness,
    kurtosis,
  };
}

/**
 * Linear interpolation between order statistics — R's type 7, and NumPy's and
 * Excel's PERCENTILE default.
 *
 * Named because there are nine definitions in common use and they disagree on
 * small samples. A quartile that silently differs from the one a researcher
 * gets in SPSS is a support question they cannot resolve.
 */
export function quantile(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sorted[0]!;
  const position = (n - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (position - lower) * (sorted[upper]! - sorted[lower]!);
}

/** Ranks with ties averaged, which is what Spearman's ρ requires. */
export function ranks(values: readonly number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);
  const out = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1]!.value === indexed[i]!.value) j += 1;
    // Average rank across the tie, 1-based.
    const rank = (i + j + 2) / 2;
    for (let k = i; k <= j; k += 1) out[indexed[k]!.index] = rank;
    i = j + 1;
  }
  return out;
}
