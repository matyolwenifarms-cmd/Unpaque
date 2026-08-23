import { describe, expect, it } from "vitest";
import {
  flowOf,
  outstanding,
  problems,
  readFlow,
  SCREENING_STATES,
  type FlowCounts,
  type ScreenedRecord,
  type ScreeningState,
} from "./flow.ts";

let next = 0;
const record = (state: ScreeningState, reason?: string): ScreenedRecord => {
  next += 1;
  return {
    id: `r${next}`,
    label: `Paper ${next}`,
    state,
    ...(reason === undefined ? {} : { reason }),
  };
};

const many = (state: ScreeningState, count: number, reason?: string) =>
  Array.from({ length: count }, () => record(state, reason));

/** The counts, or a failure saying the review was not finished. */
function completed(records: readonly ScreenedRecord[]): FlowCounts {
  const flow = flowOf(records);
  if (flow.kind !== "complete") throw new Error(`still in progress: ${flow.says}`);
  return flow.counts;
}

describe("a flow counted from the decisions", () => {
  const REVIEW = [
    ...many("duplicate", 12),
    ...many("excluded_on_title", 60),
    ...many("excluded_on_full_text", 5, "Wrong population"),
    ...many("excluded_on_full_text", 3, "No comparator"),
    ...many("included", 8),
  ];

  it("adds up, in the three subtractions a reviewer checks by hand", () => {
    const counts = completed(REVIEW);
    expect(counts.identified).toBe(88);
    expect(counts.duplicatesRemoved).toBe(12);
    expect(counts.screened).toBe(76);
    expect(counts.excludedOnTitle).toBe(60);
    expect(counts.assessed).toBe(16);
    expect(counts.excludedOnFullText).toBe(8);
    expect(counts.included).toBe(8);

    expect(counts.identified - counts.duplicatesRemoved).toBe(counts.screened);
    expect(counts.screened - counts.excludedOnTitle).toBe(counts.assessed);
    expect(counts.assessed - counts.excludedOnFullText).toBe(counts.included);
  });

  // The guarantee, asserted rather than described: there is nowhere to put a
  // number that could disagree with the records, so whatever is passed in, the
  // arithmetic holds.
  it("takes records and nothing else, so no count can be wrong", () => {
    expect(flowOf.length).toBe(1);
    for (const sample of [[], many("included", 3), many("duplicate", 9), REVIEW]) {
      const counts = completed(sample);
      expect(counts.identified - counts.duplicatesRemoved).toBe(counts.screened);
      expect(counts.screened - counts.excludedOnTitle).toBe(counts.assessed);
      expect(counts.assessed - counts.excludedOnFullText).toBe(counts.included);
    }
  });

  it("groups full-text exclusions by reason, largest first", () => {
    expect(completed(REVIEW).reasons).toEqual([
      { reason: "Wrong population", count: 5 },
      { reason: "No comparator", count: 3 },
    ]);
  });

  it("counts an empty review as nothing rather than failing", () => {
    const counts = completed([]);
    expect(counts.identified).toBe(0);
    expect(counts.included).toBe(0);
    expect(counts.reasons).toEqual([]);
  });
});

describe("a review still in progress", () => {
  const PARTWAY = [
    ...many("duplicate", 2),
    ...many("identified", 30),
    ...many("excluded_on_title", 10),
    ...many("assessed", 4),
    ...many("included", 1),
  ];

  // The defect that made the union necessary. Thirty titles unscreened, and
  // screened minus excluded-on-title does not equal assessed -- because PRISMA
  // has no box for a record nobody has decided about. The first version
  // returned the counts anyway and let the subtraction fail quietly.
  it("produces no diagram at all, rather than one that does not subtract", () => {
    const flow = flowOf(PARTWAY);
    expect(flow.kind).toBe("in_progress");
    expect(Object.keys(flow)).not.toContain("counts");
  });

  it("says how many are waiting, and at which stage", () => {
    const flow = flowOf(PARTWAY);
    if (flow.kind !== "in_progress") throw new Error("expected in progress");
    expect(flow.atTitle).toBe(30);
    expect(flow.atFullText).toBe(4);
    expect(flow.decidedSoFar).toBe(13);
    expect(flow.says).toContain("30 not yet screened");
    expect(flow.says).toContain("4 read but not yet decided");
    expect(flow.says).toContain("no box for a record nobody has decided about");
  });

  it("is finished the moment the last record is decided", () => {
    const nearly = [...many("duplicate", 2), ...many("excluded_on_title", 10), ...many("assessed", 1)];
    expect(flowOf(nearly).kind).toBe("in_progress");
    const done = [...many("duplicate", 2), ...many("excluded_on_title", 10), ...many("included", 1)];
    expect(flowOf(done).kind).toBe("complete");
  });

  it("still counts what is outstanding, for a screen that has to show progress", () => {
    expect(outstanding(PARTWAY)).toEqual({ atTitle: 30, atFullText: 4 });
  });

  it("says plainly when nothing has been screened at all", () => {
    expect(problems(many("identified", 5)).join(" ")).toContain("still in the first box");
  });
});

describe("what PRISMA asks for that decisions can still be missing", () => {
  it("names full texts excluded with no reason", () => {
    const said = problems([...many("excluded_on_full_text", 3), ...many("included", 1)]).join(" ");
    expect(said).toContain("3 full texts were excluded with no reason given");
    expect(said).toContain("PRISMA 2020");
  });

  it("says nothing about reasons when every exclusion has one", () => {
    const said = problems([
      ...many("excluded_on_full_text", 3, "Wrong design"),
      ...many("included", 1),
    ]).join(" ");
    expect(said).not.toContain("no reason given");
  });

  // Counted under a visible label rather than dropped. A record that vanishes
  // from the diagram is the arithmetic failing in the one direction nobody
  // checks: the totals still subtract, and a paper is missing.
  it("counts an unexplained exclusion under a label anybody can see", () => {
    const counts = completed(many("excluded_on_full_text", 2));
    expect(counts.excludedOnFullText).toBe(2);
    expect(counts.reasons).toEqual([{ reason: "No reason given", count: 2 }]);
  });

  it("treats whitespace as no reason at all", () => {
    expect(problems(many("excluded_on_full_text", 1, "   ")).join(" "))
      .toContain("no reason given");
  });
});

describe("the flow as prose", () => {
  it("writes the numbers out, so a methods section is not transcribed by hand", () => {
    const lines = readFlow(completed([
      ...many("duplicate", 2),
      ...many("excluded_on_title", 5),
      ...many("excluded_on_full_text", 1, "Wrong population"),
      ...many("included", 2),
    ]));
    expect(lines[0]).toBe("10 records identified.");
    expect(lines.join(" ")).toContain("2 duplicates removed, leaving 8 to screen.");
    expect(lines.join(" ")).toContain("2 included in the review.");
    expect(lines.join(" ")).toContain("Wrong population: 1.");
  });

  it("inflects, and says so when there were no duplicates", () => {
    const lines = readFlow(completed(many("included", 1)));
    expect(lines[0]).toBe("1 record identified.");
    expect(lines[1]).toBe("No duplicates were removed.");
    expect(lines.join(" ")).toContain("1 full text assessed");
  });
});

describe("the vocabulary", () => {
  it("has a state for every box PRISMA draws", () => {
    expect([...SCREENING_STATES]).toEqual([
      "identified",
      "duplicate",
      "excluded_on_title",
      "assessed",
      "excluded_on_full_text",
      "included",
    ]);
  });
});
