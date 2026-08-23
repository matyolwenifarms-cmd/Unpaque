import { describe, expect, it } from "vitest";
import { parseDataset, type Dataset } from "./dataset.ts";
import { opportunitySummary, readOpportunities } from "./questions.ts";

function load(csv: string): Dataset {
  const outcome = parseDataset(csv);
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.dataset;
}

function rows(count: number, make: (index: number) => string): string {
  return Array.from({ length: count }, (_, index) => make(index)).join("\n");
}

// Two numeric measures, a two-level factor, a three-level factor, a constant
// and a row identifier. Everything below is about which of those get paired.
const STUDY = load(
  `participant_id,site,arm,region,score,age\n${rows(40, (i) =>
    `P${i},clinic,${["control", "treatment"][i % 2]},${["north", "south", "east"][i % 3]},${i % 17},${20 + (i % 30)}`)}\n`,
);

const idsIn = (dataset: Dataset) =>
  readOpportunities(dataset).opportunities.map((one) => one.procedure.id);

describe("which questions the columns could answer", () => {
  it("offers a t-test for a measure and a two-level group", () => {
    const found = readOpportunities(STUDY);
    const t = found.opportunities.find((one) => one.procedure.id === "independent_t")!;
    expect(t.pairs).toContainEqual({ outcome: "score", factor: "arm" });
    expect(t.pairs).toContainEqual({ outcome: "age", factor: "arm" });
  });

  it("offers ANOVA for the three-level group, and not a t-test", () => {
    const found = readOpportunities(STUDY);
    const anova = found.opportunities.find((one) => one.procedure.id === "one_way_anova")!;
    expect(anova.pairs).toContainEqual({ outcome: "score", factor: "region" });
    const t = found.opportunities.find((one) => one.procedure.id === "independent_t")!;
    expect(t.pairs.some((pair) => pair.factor === "region")).toBe(false);
  });

  it("puts the measure in outcome and the group in factor, whichever came first", () => {
    // `arm` appears before `score` in the file; the measure is still the
    // outcome. A pair the other way round reads as a t-test of a group by a
    // score, which is not a thing.
    const t = readOpportunities(STUDY).opportunities
      .find((one) => one.procedure.id === "independent_t")!;
    for (const pair of t.pairs) expect(["score", "age"]).toContain(pair.outcome);
  });

  it("offers both correlations for two numeric columns", () => {
    expect(idsIn(STUDY)).toContain("pearson");
    expect(idsIn(STUDY)).toContain("spearman");
  });

  it("offers chi-square for two categorical columns", () => {
    const chi = readOpportunities(STUDY).opportunities
      .find((one) => one.procedure.id === "chi_square")!;
    expect(chi.pairs).toContainEqual({ outcome: "arm", factor: "region" });
  });

  // The exclusion that is a judgement rather than a gap, and the reason it is
  // stated on screen rather than left as an absence.
  it("never lists a paired t-test, and says why", () => {
    const found = readOpportunities(STUDY);
    expect(idsIn(STUDY)).not.toContain("paired_t");
    expect(found.notes.join(" ")).toContain("same measurement for the same person at two times");
    expect(found.notes.join(" ")).toContain("still on the analysis stage");
  });
});

describe("columns it will not pair", () => {
  it("sets aside a row identifier and a constant, with the specific reason", () => {
    const aside = readOpportunities(STUDY).setAside;
    const by = new Map(aside.map((one) => [one.column, one.because]));
    // Not "it holds free text". A participant id has more distinct values
    // than a set of levels, so both descriptions are true and only one of
    // them tells somebody what the column is.
    expect(by.get("participant_id")).toContain("row identifier");
    expect(by.get("site")).toContain("same value");
    for (const one of aside) expect(one.because.length).toBeGreaterThan(20);
  });

  it("pairs nothing with a column it set aside", () => {
    const found = readOpportunities(STUDY);
    const aside = new Set(found.setAside.map((one) => one.column));
    for (const opportunity of found.opportunities) {
      for (const pair of opportunity.pairs) {
        expect(aside.has(pair.outcome)).toBe(false);
        expect(aside.has(pair.factor)).toBe(false);
      }
    }
  });

  // Repeats deliberately, so this is not also a row identifier: with one case
  // per level the health reading sets it aside for that reason instead, and
  // the free-text rule is never the thing under test.
  it("sets aside free text that is not a row identifier", () => {
    const csv = `comment,score\n${rows(40, (i) => `"sentence number ${i % 35} about the ward",${i}`)}\n`;
    const found = readOpportunities(load(csv));
    const comment = found.setAside.find((one) => one.column === "comment");
    expect(comment).toBeDefined();
    expect(comment!.because).toContain("free text");
  });
});

describe("what it says about itself", () => {
  it("says it has run nothing, before anything else", () => {
    const notes = readOpportunities(STUDY).notes;
    expect(notes[0]).toContain("Nothing here has been run");
  });

  it("names the failure mode this list would otherwise cause", () => {
    const notes = readOpportunities(STUDY).notes.join(" ");
    expect(notes).toContain("keeping the ones that came out small");
    expect(notes).toContain("Choose from your research question");
  });

  // Nothing anywhere in the output is a number about an outcome, and nothing
  // is ordered by one. There is no field for either.
  it("carries no result and no ranking", () => {
    const found = readOpportunities(STUDY);
    const json = JSON.stringify(found);
    expect(json).not.toMatch(/"p"|pValue|statistic|effect|"score":\s*\d+\.\d/);
    // File order: `score` comes before `age` in the header, so its pair comes
    // first. Asserted on a procedure with more than one pair, or reordering
    // could not change the answer.
    const t = found.opportunities.find((one) => one.procedure.id === "independent_t")!;
    expect(t.pairs.length).toBeGreaterThan(1);
    expect(t.pairs[0]).toEqual({ outcome: "score", factor: "arm" });
  });

  it("caps a long list and still reports how many there were", () => {
    const wide = load(
      `${Array.from({ length: 12 }, (_, i) => `m${i}`).join(",")}\n${rows(30, (r) =>
        Array.from({ length: 12 }, (_, i) => String(r * (i + 1) + (r % 7))).join(","))}\n`,
    );
    const pearson = readOpportunities(wide, 5).opportunities
      .find((one) => one.procedure.id === "pearson")!;
    expect(pearson.pairs).toHaveLength(5);
    expect(pearson.total).toBe(66);
  });

  it("says so plainly when nothing fits", () => {
    const csv = `note\n${rows(30, (i) => `"a distinct sentence number ${i}"`)}\n`;
    const found = readOpportunities(load(csv));
    expect(found.opportunities).toEqual([]);
    expect(found.notes[0]).toContain("Nothing in this file supports");
    expect(opportunitySummary(found)).toContain("No procedure");
  });

  it("counts the pairs and refuses to choose between them", () => {
    expect(opportunitySummary(readOpportunities(STUDY)))
      .toContain("Which of them answers your question is a decision this cannot make");
  });
});
