import { describe, expect, it } from "vitest";
import { parseDataset, type Dataset } from "./dataset.ts";
import { availableFor, crossTabulate, PROCEDURES, run } from "./procedures.ts";

function load(csv: string): Dataset {
  const outcome = parseDataset(csv);
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.dataset;
}

const TWO_GROUPS = load([
  "arm,score,age,sex",
  "control,12,21,f", "control,15,34,m", "control,11,29,f", "control,14,41,m",
  "treatment,19,25,m", "treatment,21,38,f", "treatment,18,31,m", "treatment,22,27,f",
].join("\n"));

const THREE_GROUPS = load([
  "arm,score",
  "a,10", "a,12", "a,11", "a,13",
  "b,20", "b,22", "b,21", "b,19",
  "c,30", "c,32", "c,29", "c,31",
].join("\n"));

const column = (dataset: Dataset, name: string) =>
  dataset.columns.find((c) => c.name === name)!;

describe("what these columns can support", () => {
  it("offers the t-test for a measure across two groups, and not ANOVA", () => {
    const list = availableFor(column(TWO_GROUPS, "score"), column(TWO_GROUPS, "arm"));
    const t = list.find((a) => a.procedure.id === "independent_t")!;
    const anova = list.find((a) => a.procedure.id === "one_way_anova")!;
    expect(t.available).toBe(true);
    expect(anova.available).toBe(false);
    // Naming the count is how somebody learns the rule without being told off.
    expect(anova.whyNot).toMatch(/has 2 level\(s\); ANOVA compares three or more/);
  });

  it("offers ANOVA across three groups, and points a t-test at it", () => {
    const list = availableFor(column(THREE_GROUPS, "score"), column(THREE_GROUPS, "arm"));
    expect(list.find((a) => a.procedure.id === "one_way_anova")!.available).toBe(true);
    const t = list.find((a) => a.procedure.id === "independent_t")!;
    expect(t.available).toBe(false);
    expect(t.whyNot).toMatch(/has 3 levels.*one-way ANOVA is the corresponding test/i);
  });

  it("offers correlation for two numeric columns and refuses it for a categorical one", () => {
    const numeric = availableFor(column(TWO_GROUPS, "score"), column(TWO_GROUPS, "age"));
    expect(numeric.find((a) => a.procedure.id === "pearson")!.available).toBe(true);

    const mixed = availableFor(column(TWO_GROUPS, "score"), column(TWO_GROUPS, "arm"));
    const pearson = mixed.find((a) => a.procedure.id === "pearson")!;
    expect(pearson.available).toBe(false);
    expect(pearson.whyNot).toMatch(/"arm" is categorical/);
  });

  it("offers chi-square only for two categorical columns", () => {
    const both = availableFor(column(TWO_GROUPS, "arm"), column(TWO_GROUPS, "sex"));
    expect(both.find((a) => a.procedure.id === "chi_square")!.available).toBe(true);
    const mixed = availableFor(column(TWO_GROUPS, "arm"), column(TWO_GROUPS, "score"));
    expect(mixed.find((a) => a.procedure.id === "chi_square")!.available).toBe(false);
  });

  // An empty list teaches nothing. Every procedure comes back, with a reason.
  it("always returns every procedure, with a reason when it cannot run", () => {
    const list = availableFor(null, null);
    expect(list).toHaveLength(Object.keys(PROCEDURES).length);
    for (const entry of list) {
      expect(entry.available).toBe(false);
      expect(entry.whyNot).toBeTruthy();
    }
  });

  it("refuses the same column twice", () => {
    const list = availableFor(column(TWO_GROUPS, "score"), column(TWO_GROUPS, "score"));
    expect(list.every((a) => !a.available)).toBe(true);
    expect(list[0]!.whyNot).toMatch(/two different columns/);
  });
});

describe("running one", () => {
  it("runs a t-test across the two arms", () => {
    const outcome = run(TWO_GROUPS, "independent_t", "score", "arm");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.n).toBe(8);
    expect(outcome.finding.p).toBeLessThan(0.01);
    expect(outcome.finding.effect.magnitude).toBe("large");
  });

  it("does not care which order the two columns are given in", () => {
    const a = run(TWO_GROUPS, "independent_t", "score", "arm");
    const b = run(TWO_GROUPS, "independent_t", "arm", "score");
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.finding.p).toBeCloseTo(b.finding.p, 12);
  });

  it("runs ANOVA across three", () => {
    const outcome = run(THREE_GROUPS, "one_way_anova", "score", "arm");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.degreesOfFreedom).toEqual({ between: 2, within: 9 });
    expect(outcome.finding.p).toBeLessThan(0.001);
  });

  // The UI only offers what fits, but the UI is not the guarantee: a saved
  // analysis replayed against a re-uploaded file with a column renamed would
  // otherwise run something nonsensical and print a result.
  it("re-checks rather than trusting the caller", () => {
    const outcome = run(TWO_GROUPS, "pearson", "score", "arm");
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toMatch(/Both columns must be numeric/);
  });

  it("names a column that is not there", () => {
    const outcome = run(TWO_GROUPS, "pearson", "score", "nonexistent");
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toMatch(/no column named "nonexistent"/);
  });

  // A paired test has to keep rows aligned; filtering each column separately
  // would pair row 3 of one with row 4 of the other the moment either has a gap.
  it("keeps pairs aligned when one column has a gap", () => {
    const paired = load(["before,after", "10,12", "11,", "12,15", "13,16"].join("\n"));
    const outcome = run(paired, "paired_t", "before", "after");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.n).toBe(3);
  });
});

describe("cross-tabulating", () => {
  it("builds the table row-wise and drops incomplete rows", () => {
    const data = load(["a,b", "x,1", "x,1", "y,2", "y,1", ",2", "x,"].join("\n"));
    const table = crossTabulate(column(data, "a"), column(data, "b"))!;
    expect(table.rowLevels).toEqual(["x", "y"]);
    expect(table.columnLevels).toEqual(["1", "2"]);
    expect(table.counts).toEqual([[2, 0], [1, 1]]);
  });
});
