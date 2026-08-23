import { describe, expect, it } from "vitest";
import { suggestDisagreements, suggestionSummary, type CorpusPaper } from "./suggest.ts";

const paper = (id: string, name: string, pages: string[]): CorpusPaper => ({
  id,
  name,
  pages: pages.map((body, index) => ({ number: index + 1, body })),
});

const NDLOVU = paper("a", "Ndlovu 2019", [
  "This study covers the background to the 2018 cohort.",
  "The 2018 cohort reported 40 incidents across the four stations.",
]);
const SMITH = paper("b", "Smith 2020", [
  "A review of the literature on community broadcasting.",
  "The 2018 cohort reported 52 incidents across the four stations.",
]);
const UNRELATED = paper("c", "Dube 2022", [
  "Funding for the project ran to 7 years under the second agreement.",
]);

describe("figures that disagree across a corpus", () => {
  it("finds two papers reporting different numbers for the same thing", () => {
    const found = suggestDisagreements([NDLOVU, SMITH]);
    expect(found).toHaveLength(1);
    expect(found[0]!.a.name).toBe("Ndlovu 2019");
    expect(found[0]!.a.figure).toBe("40");
    expect(found[0]!.b.figure).toBe("52");
  });

  it("says which page each figure is on, so neither has to be opened", () => {
    const found = suggestDisagreements([NDLOVU, SMITH]);
    expect(found[0]!.a.page).toBe(2);
    expect(found[0]!.b.page).toBe(2);
    expect(found[0]!.context).toContain("cohort");
  });

  // The conservative half. Two papers mentioning unrelated numbers is the
  // common case, and reporting those is the wall of noise that teaches a
  // reviewer to close the panel.
  it("says nothing about numbers describing different things", () => {
    expect(suggestDisagreements([NDLOVU, UNRELATED])).toEqual([]);
  });

  it("says nothing when the figures agree", () => {
    expect(suggestDisagreements([NDLOVU, NDLOVU])).toEqual([]);
  });

  // Page-wise comparison is what makes this usable. Compared as two whole
  // documents, a figure on page 1 sits next to a figure on page 27 and their
  // contexts look similar because everything is in one string.
  it("compares page against page, not document against document", () => {
    const spread = paper("d", "Spread", [
      "The 2018 cohort reported 40 incidents across the four stations.",
      "An unrelated appendix listing 52 pages of correspondence.",
    ]);
    const found = suggestDisagreements([spread, SMITH]);
    // 40 against 52 is found, once, from the pages that actually match.
    expect(found).toHaveLength(1);
    expect(found[0]!.a.page).toBe(1);
  });

  it("reports a pair of figures once, however often they are repeated", () => {
    const repeated = paper("e", "Repeated", [
      "The 2018 cohort reported 40 incidents across the four stations.",
      "The 2018 cohort reported 40 incidents across the four stations.",
    ]);
    expect(suggestDisagreements([repeated, SMITH])).toHaveLength(1);
  });

  it("stops at the limit, because forty papers are 780 pairs", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      paper(`p${index}`, `Paper ${index}`, [
        `The 2018 cohort reported ${10 + index} incidents across the four stations.`,
      ]));
    expect(suggestDisagreements(many, { limit: 5 })).toHaveLength(5);
  });

  // The limit has to hold inside one pair as well as across them. Two papers
  // with several figures each produce nine disagreements between them, and a
  // budget checked only between pairs overshoots by everything one pair found.
  it("stops mid-pair when one pair of papers overruns the budget", () => {
    const wide = (id: string, base: number) =>
      paper(id, id, [10, 20, 30].map((step) =>
        `The cohort reported ${base + step} incidents across the stations.`));
    const found = suggestDisagreements([wide("A", 0), wide("B", 1)], { limit: 4 });
    expect(found).toHaveLength(4);
    expect(suggestDisagreements([wide("A", 0), wide("B", 1)]).length).toBeGreaterThan(4);
  });
});

describe("what it refuses to do", () => {
  // The whole design, asserted rather than described. There is no path from
  // "these two numbers differ" to a stored claim that one paper contradicts
  // another, because a suggestion has nowhere to put one.
  it("carries no relation and no basis", () => {
    const found = suggestDisagreements([NDLOVU, SMITH]);
    const keys = Object.keys(found[0]!);
    expect(keys.sort()).toEqual(["a", "b", "context"]);
    expect(JSON.stringify(found)).not.toMatch(/contradict|corroborat|basis|relation/i);
  });

  it("says a disagreeing figure is not a contradiction", () => {
    const said = suggestionSummary(suggestDisagreements([NDLOVU, SMITH]), 2);
    expect(said).toContain("not a contradiction");
    expect(said).toContain("a question for you rather than a finding");
  });

  // Silence here means "no figure in matching wording disagreed". It does not
  // mean the papers agree, and a reviewer who reads it that way has been told
  // something false by an empty list.
  it("does not let an empty list read as agreement", () => {
    const said = suggestionSummary([], 5);
    expect(said).toContain("two papers can disagree about everything and still not appear here");
  });

  it("says two are needed before anything can be compared", () => {
    expect(suggestionSummary([], 1)).toContain("Two papers are needed");
  });
});
