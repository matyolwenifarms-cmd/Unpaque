import { describe, expect, it } from "vitest";
import {
  chiSquareP,
  fP,
  incompleteBeta,
  logGamma,
  normalCdf,
  normalQuantile,
  studentP,
  studentQuantile,
} from "./distributions.ts";

// Checked against values printed in statistics tables, not against another
// implementation of the same algorithm — which would only prove the two agree.
// Wrong statistics do not announce themselves; a t-test that is off in the
// third decimal produces a research finding nobody can reproduce and nobody
// can see is wrong.

describe("logGamma", () => {
  it("reproduces the factorials", () => {
    // Γ(n) = (n−1)!
    for (const [n, factorial] of [[1, 1], [2, 1], [3, 2], [4, 6], [5, 24], [6, 120], [11, 3628800]] as const) {
      expect(Math.exp(logGamma(n))).toBeCloseTo(factorial, 5);
    }
  });

  it("knows Γ(1/2) = √π", () => {
    expect(Math.exp(logGamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 10);
  });
});

describe("the normal distribution", () => {
  it("matches the table at the landmarks", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 12);
    expect(normalCdf(1)).toBeCloseTo(0.8413447, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 6);
    // 0.99500247, not 0.9950045 — the value first written here was wrong and
    // the implementation was right. Φ(2.5758293) = 0.995 exactly, and 2.576 is
    // 1.7e-4 further out, worth 2.5e-6 of density.
    expect(normalCdf(2.576)).toBeCloseTo(0.9950025, 6);
    expect(normalCdf(-1.645)).toBeCloseTo(0.0499848, 6);
  });

  it("inverts itself", () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.995)).toBeCloseTo(2.575829, 5);
    for (const p of [0.001, 0.05, 0.25, 0.5, 0.75, 0.95, 0.999]) {
      expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 10);
    }
  });
});

describe("the incomplete beta", () => {
  it("is 0 at 0, 1 at 1, and symmetric at the half", () => {
    expect(incompleteBeta(0, 2, 3)).toBe(0);
    expect(incompleteBeta(1, 2, 3)).toBe(1);
    expect(incompleteBeta(0.5, 3, 3)).toBeCloseTo(0.5, 12);
  });

  // With a = b = 1 the beta is uniform, so I_x(1,1) = x exactly.
  it("is the identity for a = b = 1", () => {
    for (const x of [0.1, 0.3, 0.5, 0.77, 0.9]) {
      expect(incompleteBeta(x, 1, 1)).toBeCloseTo(x, 12);
    }
  });
});

describe("Student's t", () => {
  // Two-tailed p at the critical values every table prints for α = .05.
  it("gives p = .05 at the published critical values", () => {
    for (const [df, critical] of [
      [1, 12.706], [2, 4.303], [5, 2.571], [10, 2.228],
      [20, 2.086], [30, 2.042], [60, 2.000], [120, 1.980],
    ] as const) {
      expect(studentP(critical, df)).toBeCloseTo(0.05, 3);
    }
  });

  it("gives p = .01 at the 1% critical values", () => {
    for (const [df, critical] of [[5, 4.032], [10, 3.169], [20, 2.845], [30, 2.750]] as const) {
      expect(studentP(critical, df)).toBeCloseTo(0.01, 3);
    }
  });

  it("is 1 at t = 0 and approaches the normal as df grows", () => {
    expect(studentP(0, 10)).toBeCloseTo(1, 12);
    expect(studentP(1.96, 100000)).toBeCloseTo(0.05, 3);
  });

  it("inverts itself", () => {
    for (const [df, critical] of [[5, 2.571], [10, 2.228], [30, 2.042]] as const) {
      expect(studentQuantile(0.05, df)).toBeCloseTo(critical, 2);
    }
  });
});

describe("chi-square", () => {
  it("gives p = .05 at the published critical values", () => {
    for (const [df, critical] of [
      [1, 3.841], [2, 5.991], [3, 7.815], [4, 9.488], [5, 11.070], [10, 18.307],
    ] as const) {
      expect(chiSquareP(critical, df)).toBeCloseTo(0.05, 3);
    }
  });

  it("gives p = .01 at the 1% critical values", () => {
    for (const [df, critical] of [[1, 6.635], [2, 9.210], [5, 15.086]] as const) {
      expect(chiSquareP(critical, df)).toBeCloseTo(0.01, 3);
    }
  });

  // With df = 1, chi-square is the square of a standard normal, so the
  // upper-tail p must equal the two-tailed normal p for its root.
  it("agrees with the normal at df = 1", () => {
    for (const z of [0.5, 1, 1.96, 2.5]) {
      expect(chiSquareP(z * z, 1)).toBeCloseTo(2 * (1 - normalCdf(z)), 10);
    }
  });
});

describe("the F distribution", () => {
  it("gives p = .05 at the published critical values", () => {
    for (const [df1, df2, critical] of [
      [1, 10, 4.965], [2, 10, 4.103], [3, 12, 3.490],
      [2, 20, 3.493], [4, 30, 2.690], [1, 100, 3.936],
    ] as const) {
      expect(fP(critical, df1, df2)).toBeCloseTo(0.05, 3);
    }
  });

  // F(1, n) is t(n) squared, which is the cheapest independent check available
  // that the two share no mistake.
  it("agrees with t at df1 = 1", () => {
    for (const [t, df] of [[2.228, 10], [2.086, 20], [2.042, 30]] as const) {
      expect(fP(t * t, 1, df)).toBeCloseTo(studentP(t, df), 10);
    }
  });
});
