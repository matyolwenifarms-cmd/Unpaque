import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CONTRADICTION_STATUSES,
  CONTRADICTION_TYPES,
  differsOnlyInWording,
  findNumericConflicts,
  fromTimelineDiscrepancy,
  normaliseStatement,
  recordProblems,
  type ContradictionRecord,
} from "./contradiction.ts";
import {
  DATE_CERTAINTIES,
  findTemporalDiscrepancies,
  TIME_ORIGINS,
  type TimelineEvent,
} from "./timeline.ts";

describe("§10's warning, as a check rather than a caution", () => {
  it.each([
    ["The tender was awarded in March.", "the tender was awarded in march"],
    ["The meeting took place on the 14th.", "The meeting took place on the 14th"],
    ["He arrived at about 40 minutes past.", "He arrived at approximately 40 minutes past."],
    ["A report was filed — that day.", "A report was filed that day"],
  ])("sees %s and %s as the same statement", (a, b) => {
    expect(differsOnlyInWording(a, b)).toBe(true);
  });

  it.each([
    ["Forty were affected.", "Fifty were affected."],
    ["The tender was awarded in March.", "The tender was cancelled in March."],
  ])("does not collapse %s and %s", (a, b) => {
    expect(differsOnlyInWording(a, b)).toBe(false);
  });

  it("reports nothing for a pure rephrasing", () => {
    expect(findNumericConflicts(
      { sourceId: "s1", text: "About 40 households were affected." },
      { sourceId: "s2", text: "Approximately 40 households were affected" },
    )).toEqual([]);
  });

  // differsOnlyInWording is for prose comparison, not this one. Documented
  // because it was briefly wired in here where it could never fire.
  it("is prose, not numbers, that the wording guard protects", () => {
    expect(differsOnlyInWording("The meeting was moved.", "the meeting was moved"))
      .toBe(true);
    expect(differsOnlyInWording("The meeting was moved.", "The meeting was cancelled."))
      .toBe(false);
  });

  it("keeps meaningful words while stripping filler", () => {
    expect(normaliseStatement("The report was, approximately, quite late."))
      .toBe("report was late");
  });
});

describe("numbers that disagree about the same thing", () => {
  it("finds a figure that changed between two accounts", () => {
    const found = findNumericConflicts(
      { sourceId: "s1", text: "In total 40 households were affected by the outage." },
      { sourceId: "s2", text: "In total 62 households were affected by the outage." },
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.difference).toMatch(/40 against 62/);
    expect(found[0]?.type).toBe("documentary");
  });

  // The conservative half. Two documents mentioning unrelated numbers is the
  // common case, and flagging those is the wall of noise §10 warns about.
  // Numerals on both sides deliberately. An earlier version of this test used
  // the word "forty" on one side, which meant only one numeral existed across
  // the pair and no comparison happened at all — it passed without exercising
  // the thing it names.
  it("ignores unrelated numbers in unrelated sentences", () => {
    expect(findNumericConflicts(
      { sourceId: "s1", text: "40 households were affected by the outage." },
      { sourceId: "s2", text: "The contract ran for 42 months from signature." },
    )).toEqual([]);
  });

  it("can be told to be stricter or looser about context", () => {
    const statements = [
      { sourceId: "s1", text: "The panel received 12 submissions before the deadline." },
      { sourceId: "s2", text: "The committee received 19 submissions before closing." },
    ] as const;
    expect(findNumericConflicts(statements[0], statements[1], { contextOverlap: 0.95 })).toEqual([]);
    expect(findNumericConflicts(statements[0], statements[1], { contextOverlap: 0.3 }).length)
      .toBeGreaterThan(0);
  });

  it("reports each pair of values once, not once per mention", () => {
    const found = findNumericConflicts(
      { sourceId: "s1", text: "40 were affected; 40 were affected in the second district too." },
      { sourceId: "s2", text: "62 were affected; 62 were affected in the second district too." },
    );
    expect(found).toHaveLength(1);
  });

  it("never returns anything verified", () => {
    const found = findNumericConflicts(
      { sourceId: "s1", text: "In total 40 households were affected by the outage." },
      { sourceId: "s2", text: "In total 62 households were affected by the outage." },
    );
    for (const record of found) expect(record.status).toBe("potential");
  });

  // "One figure is wrong" is present, and is not the only thing offered.
  it("offers innocent explanations alongside the obvious one", () => {
    const [record] = findNumericConflicts(
      { sourceId: "s1", text: "In total 40 households were affected by the outage." },
      { sourceId: "s2", text: "In total 62 households were affected by the outage." },
    );
    const summaries = record!.explanations.map((e) => e.summary);
    expect(summaries.some((s) => /count different things/i.test(s))).toBe(true);
    expect(summaries.some((s) => /different dates/i.test(s))).toBe(true);
    expect(summaries.some((s) => /revised/i.test(s))).toBe(true);
    expect(summaries.some((s) => /One figure is wrong/i.test(s))).toBe(true);
    expect(summaries.findIndex((s) => /One figure is wrong/i.test(s))).toBeGreaterThan(0);
  });
});

describe("a timeline discrepancy becomes a contradiction record", () => {
  const statement: TimelineEvent = {
    id: "e1", label: "Says they left Location X", at: "2026-06-14T20:00:00Z",
    certainty: "claimed", origin: "account", sourceId: "s-statement",
  };
  const cctv: TimelineEvent = {
    id: "e2", label: "Vehicle appears at Location X", at: "2026-06-14T20:37:00Z",
    certainty: "confirmed", origin: "recording", sourceId: "s-cctv",
  };
  const [discrepancy] = findTemporalDiscrepancies([statement, cctv]);
  const record = fromTimelineDiscrepancy(discrepancy!);

  it("states the exact difference rather than that they disagree", () => {
    expect(record.difference).toMatch(/20:00/);
    expect(record.difference).toMatch(/20:37/);
    expect(record.difference).toMatch(/37 minutes apart/);
  });

  it("is temporal, potential, and names both sources", () => {
    expect(record.type).toBe("temporal");
    expect(record.status).toBe("potential");
    expect(record.sourceA).toBe("s-statement");
    expect(record.sourceB).toBe("s-cctv");
  });

  // One catalogue. A change to how the system talks about temporal conflicts
  // must not apply in the timeline and not here.
  it("reuses the timeline's explanations rather than writing its own", () => {
    expect(record.explanations).toBe(discrepancy!.explanations);
  });

  it("passes its own completeness check", () => {
    expect(recordProblems(record)).toEqual([]);
  });
});

describe("what makes a record fit to show anybody", () => {
  const sound: ContradictionRecord = {
    type: "direct",
    sourceA: "s1",
    sourceB: "s2",
    difference: "'awarded in March' against 'awarded in May'",
    explanations: [
      { summary: "Different award stages are being described.", distinguishedBy: "The award notice itself." },
      { summary: "One record is wrong.", distinguishedBy: "The registry entry both derive from." },
    ],
    significance: "The award date determines which procurement rules applied.",
    status: "potential",
  };

  it("accepts a complete record", () => {
    expect(recordProblems(sound)).toEqual([]);
  });

  it("refuses a source contradicting itself", () => {
    expect(recordProblems({ ...sound, sourceB: "s1" }))
      .toContain("a source cannot contradict itself");
  });

  it("refuses a bare assertion of conflict with no stated difference", () => {
    expect(recordProblems({ ...sound, difference: "  " }))
      .toContain("the exact difference is not stated");
  });

  // A single explanation is not an explanation, it is a verdict with extra
  // steps — which is the thing §10 exists to prevent.
  it("refuses a single explanation", () => {
    const problems = recordProblems({ ...sound, explanations: [sound.explanations[0]!] });
    expect(problems.join(" ")).toMatch(/a single explanation is a conclusion/);
  });

  it("refuses an explanation nothing could settle", () => {
    const problems = recordProblems({
      ...sound,
      explanations: [sound.explanations[0]!, { summary: "Something else happened.", distinguishedBy: "" }],
    });
    expect(problems.join(" ")).toMatch(/no evidence named that would settle/);
  });

  it("refuses a record that does not say why it matters", () => {
    expect(recordProblems({ ...sound, significance: "" }))
      .toContain("significance to the investigation is not stated");
  });

  it("covers every contradiction type the specification names", () => {
    expect([...CONTRADICTION_TYPES].sort()).toEqual([
      "direct", "documentary", "evidentiary", "geographic", "narrative", "temporal",
    ]);
  });
});


const timelineMigration = readFileSync(
  fileURLToPath(new URL("../../../migrations/20260822020000_detective_events_contradictions.sql", import.meta.url)),
  "utf8",
);

function pgEnum(name: string): string[] {
  const match = new RegExp(`create type public\\.${name} as enum \\(([^)]*)\\)`, "s").exec(timelineMigration);
  if (!match) throw new Error(`no enum ${name} in the timeline migration`);
  return [...match[1]!.matchAll(/'([^']+)'/g)].map((entry) => entry[1]!);
}

describe("the timeline and contradiction enums still agree with Postgres", () => {
  it.each([
    ["date_certainty", DATE_CERTAINTIES],
    ["time_origin", TIME_ORIGINS],
    ["contradiction_type", CONTRADICTION_TYPES],
    ["contradiction_status", CONTRADICTION_STATUSES],
  ])("matches %s", (name, values) => {
    expect([...values].sort()).toEqual(pgEnum(name).sort());
  });

  it("actually reads the migration", () => {
    expect(() => pgEnum("no_such_enum")).toThrow(/no enum/);
  });

  // The same rule, written twice on purpose — once where the engine can apply
  // it and once where the database can. This asserts the two numbers agree, so
  // relaxing one without the other is caught.
  it("requires the same minimum explanations in SQL as recordProblems does", () => {
    expect(timelineMigration).toMatch(/jsonb_array_length\(p_explanations\) >= 2/);
    const problems = recordProblems({
      type: "direct", sourceA: "a", sourceB: "b", difference: "d",
      explanations: [{ summary: "s", distinguishedBy: "d" }],
      significance: "x", status: "potential",
    });
    expect(problems.join(" ")).toMatch(/fewer than two/);
  });
});
