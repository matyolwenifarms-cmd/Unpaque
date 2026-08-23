import { describe, expect, it } from "vitest";
import {
  agreementBetween,
  conventionalLabel,
  kappaFrom,
  reportKappa,
  type ComputedAgreement,
} from "./agreement.ts";
import { unitsOf } from "./units.ts";
import type { Code } from "./codebook.ts";
import type { Coding } from "./coding.ts";

const code = (id: string, label: string): Code => ({
  id, label,
  definition: `Where a participant speaks about ${label}.`,
  when: `Any passage about ${label}.`,
  notWhen: "Not a passing mention.",
});

const coding = (
  id: string, documentId: string, codeId: string, start: number, end: number, coderId: string,
): Coding => ({ id, documentId, codeId, start, end, coderId });

const computed = (result: ReturnType<typeof kappaFrom>): ComputedAgreement => {
  if (result.kind !== "computed") throw new Error(`expected a kappa, got: ${result.says}`);
  return result;
};

describe("dividing a document into units", () => {
  const TEXT = "First turn, about cost.\n\nSecond turn, about trust.\n\nThird turn, neither.";

  it("splits paragraphs on blank lines and keeps offsets into the source", () => {
    const units = unitsOf(TEXT, "paragraph");
    expect(units).toHaveLength(3);
    expect(TEXT.slice(units[0]!.start, units[0]!.end)).toBe("First turn, about cost.");
    expect(TEXT.slice(units[2]!.start, units[2]!.end)).toBe("Third turn, neither.");
  });

  it("splits lines on every break", () => {
    expect(unitsOf("a\nb\nc", "line")).toHaveLength(3);
  });

  // Counting a run of blank lines as units neither coder coded would make
  // agreement look better the more whitespace a transcript happened to carry.
  it("does not make a unit out of whitespace", () => {
    const units = unitsOf("a\n\n\n\n   \n\nb", "paragraph");
    expect(units).toHaveLength(2);
    expect(units.every((unit) => unit.end > unit.start)).toBe(true);
  });

  it("returns nothing for an empty document", () => {
    expect(unitsOf("   \n\n  ", "paragraph")).toEqual([]);
  });
});

describe("kappa from a table", () => {
  // Worked by hand: n = 50, observed .70, expected .50, so kappa = .40 and the
  // interval is [.146, .654].
  it("computes the figure, the interval and the two cell proportions", () => {
    const result = computed(kappaFrom("c1", { both: 20, firstOnly: 5, secondOnly: 10, neither: 15 }));
    expect(result.units).toBe(50);
    expect(result.observed).toBeCloseTo(0.7, 10);
    expect(result.expected).toBeCloseTo(0.5, 10);
    expect(result.kappa).toBeCloseTo(0.4, 10);
    expect(result.standardError).toBeCloseTo(0.1296, 4);
    if (result.interval.kind !== "estimated") throw new Error(result.interval.says);
    expect(result.interval.low).toBeCloseTo(0.146, 3);
    expect(result.interval.high).toBeCloseTo(0.654, 3);
  });

  // "95% CI [1.00, 1.00]" in a methods chapter is a claim of certainty nobody
  // made. The interval is a union so the degenerate case cannot be read as a
  // pair of numbers by accident.
  it("is 1 when the coders never differ, and refuses to bound it", () => {
    const result = computed(kappaFrom("c1", { both: 20, firstOnly: 0, secondOnly: 0, neither: 30 }));
    expect(result.kappa).toBeCloseTo(1, 10);
    expect(result.observed).toBe(1);
    expect(result.interval.kind).toBe("degenerate");
    if (result.interval.kind !== "degenerate") throw new Error("unreachable");
    expect(result.interval.says).toMatch(/artefact of the method, not a finding/);
    expect(result.interval.says).toMatch(/across 50 units/);
  });

  it("is 0 when they agree exactly as often as chance predicts", () => {
    // Each applies it to half the units, and they overlap on a quarter.
    const result = computed(kappaFrom("c1", { both: 25, firstOnly: 25, secondOnly: 25, neither: 25 }));
    expect(result.kappa).toBeCloseTo(0, 10);
  });

  it("goes negative when they agree less than chance", () => {
    const result = computed(kappaFrom("c1", { both: 5, firstOnly: 45, secondOnly: 45, neither: 5 }));
    expect(result.kappa).toBeLessThan(0);
  });

  it("never reports an interval outside the possible range", () => {
    const result = computed(kappaFrom("c1", { both: 49, firstOnly: 1, secondOnly: 0, neither: 50 }));
    if (result.interval.kind !== "estimated") throw new Error(result.interval.says);
    expect(result.interval.high).toBeLessThanOrEqual(1);
    expect(result.interval.low).toBeGreaterThanOrEqual(-1);
  });

  // Reading a whole generated report is what showed this: a kappa of .62 sat
  // beside "substantial" with an interval running from -.10 to 1.00.
  it("says when the interval spans chance, whatever the label claims", () => {
    const result = computed(kappaFrom("c1", { both: 1, firstOnly: 0, secondOnly: 1, neither: 8 }));
    if (result.interval.kind !== "estimated") throw new Error(result.interval.says);
    expect(result.interval.low).toBeLessThan(0);
    expect(result.cautions.join(" ")).toMatch(/interval includes zero/);
    expect(result.cautions.join(" ")).toMatch(/do not distinguish this from agreement by chance/);
  });
});

// The whole reason this is a union and not a number with an optional field.
describe("the four ways kappa is undefined", () => {
  it("refuses when neither coder used the code, rather than reporting nothing agreed", () => {
    const result = kappaFrom("c1", { both: 0, firstOnly: 0, secondOnly: 0, neither: 40 });
    expect(result.kind).toBe("undefined");
    if (result.kind !== "undefined") throw new Error("unreachable");
    expect(result.says).toMatch(/Neither coder applied this code/);
    expect(result.says).toMatch(/a fact about the codebook, not about the coders/);
  });

  // The dangerous one. Both coders coded every unit, agreed completely, and
  // the arithmetic is 0/0 — reported as 0 it says they agreed no better than
  // chance, which is the opposite of what happened.
  it("refuses when both coders applied the code everywhere, and says agreement was total", () => {
    const result = kappaFrom("c1", { both: 40, firstOnly: 0, secondOnly: 0, neither: 0 });
    expect(result.kind).toBe("undefined");
    if (result.kind !== "undefined") throw new Error("unreachable");
    expect(result.says).toMatch(/Both coders applied this code to every unit/);
    expect(result.says).toMatch(/all 40 of them — which is not the same as agreeing by chance/);
  });

  // Not undefined, which is the correction: expected agreement is low here,
  // not total, so kappa is a well defined 0. What it is not is a measure of
  // how well the coders agree.
  it("computes a real zero when one coder never used the code, and says what it means", () => {
    const result = kappaFrom("c1", { both: 0, firstOnly: 10, secondOnly: 0, neither: 30 });
    expect(result.kind).toBe("computed");
    if (result.kind !== "computed") throw new Error("unreachable");
    expect(result.kappa).toBeCloseTo(0, 10);
    expect(result.cautions.join(" ")).toMatch(/One coder never applied this code/);
    expect(result.cautions.join(" ")).toMatch(/the codebook has to settle first/);
  });

  it("refuses when there is nothing to compare", () => {
    expect(kappaFrom("c1", { both: 0, firstOnly: 0, secondOnly: 0, neither: 0 }).kind)
      .toBe("undefined");
  });
});

describe("what a reader has to be told alongside the number", () => {
  // Byrt, Bishop and Carlin (1993). 96% agreement, kappa .32.
  it("names the paradox when a rare code drags kappa down", () => {
    const result = computed(kappaFrom("c1", { both: 2, firstOnly: 2, secondOnly: 2, neither: 94 }));
    expect(result.observed).toBeCloseTo(0.96, 10);
    expect(result.kappa).toBeLessThan(0.6);
    expect(result.prevalenceIndex).toBeGreaterThan(0.8);
    expect(result.cautions.join(" ")).toMatch(/agreed on 96% of units/);
    expect(result.cautions.join(" ")).toMatch(/very unevenly distributed/);
  });

  it("names a coder who applies a code far more than the other", () => {
    const result = computed(kappaFrom("c1", { both: 10, firstOnly: 35, secondOnly: 5, neither: 50 }));
    expect(result.biasIndex).toBeGreaterThan(0.2);
    expect(result.cautions.join(" ")).toMatch(/far more often than the other/);
  });

  it("says nothing when there is nothing to say", () => {
    expect(computed(kappaFrom("c1", { both: 30, firstOnly: 5, secondOnly: 5, neither: 30 })).cautions)
      .toEqual([]);
  });

  // Several can be true at once, and a single field would hide whichever was
  // ranked second. A rare code will usually also have an interval spanning
  // zero.
  it("gives every caution that applies, not the first one", () => {
    // One coder applies it four times as often, and the interval spans zero.
    const result = computed(kappaFrom("c1", { both: 1, firstOnly: 3, secondOnly: 0, neither: 6 }));
    expect(result.cautions).toHaveLength(2);
    expect(result.cautions.join(" ")).toMatch(/far more often than the other/);
    expect(result.cautions.join(" ")).toMatch(/interval includes zero/);
  });

  // A convention, not a standard, and it is disputed. Attribution is what
  // makes the caveat travel with the label.
  it("labels a kappa the conventional way", () => {
    expect(conventionalLabel(0.9)).toBe("almost perfect");
    expect(conventionalLabel(0.7)).toBe("substantial");
    expect(conventionalLabel(0.5)).toBe("moderate");
    expect(conventionalLabel(-0.1)).toBe("less agreement than chance");
  });
});

describe("reporting it", () => {
  it("drops the leading zero, as APA does for bounded coefficients", () => {
    const result = computed(kappaFrom("c1", { both: 20, firstOnly: 5, secondOnly: 10, neither: 15 }));
    expect(reportKappa(result, "paragraph")).toBe(
      "Cohen's κ = .40, 95% CI [.15, .65], across 50 paragraphs, with 70% observed agreement.",
    );
  });

  it("omits the interval rather than printing a zero-width one", () => {
    const result = computed(kappaFrom("c1", { both: 20, firstOnly: 0, secondOnly: 0, neither: 30 }));
    expect(reportKappa(result, "paragraph")).toBe(
      "Cohen's κ = 1.00 across 50 paragraphs, with 100% observed agreement.",
    );
  });

  it("keeps the minus sign on a negative kappa", () => {
    const result = computed(kappaFrom("c1", { both: 5, firstOnly: 45, secondOnly: 45, neither: 5 }));
    expect(reportKappa(result, "line")).toMatch(/κ = -\./);
  });
});

describe("agreement across a study", () => {
  const DOC =
    "The cost was the first thing everyone mentioned.\n\n" +
    "Nobody trusted the process at all.\n\n" +
    "The waiting was worse than the money.\n\n" +
    "None of that bothered me.";
  const documents = new Map([["d1", DOC]]);
  const codes = [code("cost", "cost"), code("trust", "trust")];

  it("reads both coders against the same units", () => {
    const codings = [
      // Both put "cost" on the first paragraph.
      coding("g1", "d1", "cost", 4, 8, "amy"),
      coding("g2", "d1", "cost", 0, 12, "ben"),
      // Only Amy puts it on the third.
      coding("g3", "d1", "cost", 90, 100, "amy"),
      // Both put "trust" on the second.
      coding("g4", "d1", "trust", 56, 63, "amy"),
      coding("g5", "d1", "trust", 49, 70, "ben"),
    ];
    const outcome = agreementBetween("amy", "ben", codes, codings, documents, "paragraph");
    if (outcome.kind !== "read") throw new Error(outcome.says);
    expect(outcome.units).toBe(4);

    const cost = outcome.agreements.find((a) => a.codeId === "cost")!;
    if (cost.kind !== "computed") throw new Error(cost.says);
    expect(cost.table).toEqual({ both: 1, firstOnly: 1, secondOnly: 0, neither: 2 });

    // Trust: agreed on one unit, neither used it on the other three.
    const trust = outcome.agreements.find((a) => a.codeId === "trust")!;
    if (trust.kind !== "computed") throw new Error(trust.says);
    expect(trust.table).toEqual({ both: 1, firstOnly: 0, secondOnly: 0, neither: 3 });
    expect(trust.kappa).toBeCloseTo(1, 10);
  });

  it("counts a code only for the coder who applied it", () => {
    const codings = [coding("g1", "d1", "cost", 4, 8, "amy")];
    const outcome = agreementBetween("amy", "ben", codes, codings, documents, "paragraph");
    if (outcome.kind !== "read") throw new Error(outcome.says);
    const cost = outcome.agreements.find((a) => a.codeId === "cost")!;
    if (cost.kind !== "computed") throw new Error(cost.says);
    expect(cost.table).toEqual({ both: 0, firstOnly: 1, secondOnly: 0, neither: 3 });
    // Ben never used it. Kappa is defined and is zero, and the caution is what
    // carries the meaning.
    expect(cost.cautions.join(" ")).toMatch(/One coder never applied this code/);
  });

  it("refuses to compare somebody with themselves", () => {
    const outcome = agreementBetween("amy", "amy", codes, [], documents, "paragraph");
    expect(outcome.kind).toBe("not_possible");
    if (outcome.kind !== "not_possible") throw new Error("unreachable");
    expect(outcome.says).toMatch(/two different coders/);
  });

  it("refuses when there is nothing coded to compare across", () => {
    const outcome = agreementBetween("amy", "ben", codes, [], new Map(), "paragraph");
    expect(outcome.kind).toBe("not_possible");
  });
});
