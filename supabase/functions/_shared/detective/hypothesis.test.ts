import { describe, expect, it } from "vitest";
import {
  assembleHypotheses,
  discriminatingQuestion,
  discriminators,
  hypothesisProblems,
  type HypothesisDraft,
  type HypothesisEvidence,
} from "./hypothesis.ts";
import { runSkeptic } from "./skeptic.ts";

const draft = (id: string, statement: string, over: Partial<HypothesisDraft> = {}): HypothesisDraft => ({
  id,
  statement,
  falsifier: `A record placing them elsewhere would end ${id}.`,
  assumptions: ["The records are complete."],
  ...over,
});

let n = 0;
const ev = (
  hypothesisId: string,
  classification: HypothesisEvidence["classification"],
  over: Partial<HypothesisEvidence> = {},
): HypothesisEvidence => ({
  id: `e${(n += 1)}`,
  hypothesisId,
  classification,
  sourceId: over.sourceId ?? `s${n}`,
  sourceTitle: over.sourceTitle ?? `Source ${n}`,
  summary: over.summary ?? `Record ${n}`,
  ...over,
});

const read = (drafts: HypothesisDraft[], evidence: HypothesisEvidence[]) => {
  const outcome = assembleHypotheses(drafts, evidence);
  if (outcome.kind !== "read") throw new Error(outcome.says);
  return outcome.set;
};

describe("what a hypothesis has to carry", () => {
  it("refuses one with nothing that would falsify it", () => {
    const problems = hypothesisProblems({ statement: "Person A was involved.", falsifier: "" });
    expect(problems[0]?.field).toBe("falsifier");
    expect(problems[0]?.says).toMatch(/not being tested by anything you gather/);
  });

  it("accepts one that states both", () => {
    expect(hypothesisProblems(draft("h1", "Person A was involved."))).toEqual([]);
  });
});

// "The Detective must never be forced into one theory."
describe("refusing to work on a lone theory", () => {
  it("refuses when only one explanation is stated", () => {
    const outcome = assembleHypotheses([draft("h1", "Person A was involved.")], []);
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") throw new Error("unreachable");
    expect(outcome.says).toMatch(/alternatives were never written down/);
    expect(outcome.says).toMatch(/including the one you think is wrong/);
  });

  it("refuses when none is stated", () => {
    expect(assembleHypotheses([], []).kind).toBe("refused");
  });

  // A draft with no falsifier is not a hypothesis, so two drafts of which one
  // is incomplete is still one hypothesis.
  it("does not count an unfalsifiable draft towards the pair", () => {
    const outcome = assembleHypotheses(
      [draft("h1", "A was involved."), draft("h2", "A was not.", { falsifier: "  " })],
      [],
    );
    expect(outcome.kind).toBe("refused");
  });

  it("reads two", () => {
    const set = read([draft("h1", "A was involved."), draft("h2", "A was not.")], []);
    expect(set.hypotheses).toHaveLength(2);
  });
});

describe("what the record shows about each", () => {
  it("counts independent support rather than records", () => {
    const set = read(
      [draft("h1", "A was involved."), draft("h2", "A was not.")],
      [
        ev("h1", "supports", { sourceId: "s1", contentHash: "same" }),
        ev("h1", "supports", { sourceId: "s2", contentHash: "same" }),
        ev("h1", "supports", { sourceId: "s3", contentHash: "other" }),
      ],
    );
    const first = set.hypotheses[0]!;
    expect(first.supporting).toHaveLength(3);
    expect(first.independentSupport).toBe(2);
  });

  // Found by generating a whole report and reading it: three statements from
  // one supervisor were arriving as three independent sources. The test above
  // passed throughout, because its fixture happened to use distinct sources.
  it("counts one source once, however many records it supplies", () => {
    const set = read(
      [draft("h1", "A was involved."), draft("h2", "A was not.")],
      [
        ev("h1", "supports", { sourceId: "s1", sourceTitle: "One witness" }),
        ev("h1", "supports", { sourceId: "s1", sourceTitle: "One witness" }),
        ev("h1", "supports", { sourceId: "s1", sourceTitle: "One witness" }),
      ],
    );
    expect(set.hypotheses[0]!.supporting).toHaveLength(3);
    expect(set.hypotheses[0]!.independentSupport).toBe(1);
  });

  it("counts a wire story printed twice as one source, not two", () => {
    const set = read(
      [draft("h1", "A was involved."), draft("h2", "A was not.")],
      [
        ev("h1", "supports", { sourceId: "s1", contentHash: "wire" }),
        ev("h1", "supports", { sourceId: "s2", contentHash: "wire" }),
        ev("h1", "supports", { sourceId: "s3" }),
      ],
    );
    expect(set.hypotheses[0]!.independentSupport).toBe(2);
  });

  // A hypothesis nobody searched against and one that survived a search look
  // identical unless the difference is named.
  it("distinguishes never having been tested from having survived", () => {
    const set = read(
      [draft("h1", "A was involved."), draft("h2", "A was not.")],
      [ev("h1", "supports"), ev("h2", "inconclusive")],
    );
    expect(set.hypotheses[0]!.testedAgainst).toBe(false);
    expect(set.hypotheses[1]!.testedAgainst).toBe(true);
  });

  it("treats a record undermining the source as evidence against", () => {
    const set = read(
      [draft("h1", "A was involved."), draft("h2", "A was not.")],
      [ev("h1", "undermines_source")],
    );
    expect(set.hypotheses[0]!.contradicting).toHaveLength(1);
  });

  // Nothing is ranked. A leaderboard of theories is the collapse into truth
  // that the epistemic model exists to prevent, wearing a number.
  it("keeps the stated order and offers no score", () => {
    const set = read(
      [draft("h1", "A was involved."), draft("h2", "A was not.")],
      [ev("h1", "supports"), ev("h1", "supports"), ev("h1", "supports")],
    );
    expect(set.hypotheses.map((h) => h.id)).toEqual(["h1", "h2"]);
    expect(JSON.stringify(set)).not.toMatch(/likelihood|score|rank|probability/i);
  });
});

describe("what separates two explanations, and what does not", () => {
  it("finds the record that supports one and contradicts the other", () => {
    const shared = { sourceId: "s9", summary: "The vehicle was blue." };
    const set = read(
      [draft("h1", "A was involved."), draft("h2", "A was not.")],
      [ev("h1", "supports", shared), ev("h2", "contradicts", shared)],
    );
    const found = discriminators(set.hypotheses[0]!, set.hypotheses[1]!);
    expect(found).toHaveLength(1);
    expect(found[0]!.favours).toBe("h1");
    expect(found[0]!.against).toBe("h2");
  });

  // The confirmation-bias trap: a record consistent with everything feels like
  // progress and moves nothing.
  it("names evidence that fits every explanation", () => {
    const both = { sourceId: "s9", summary: "It rained that night." };
    const set = read(
      [draft("h1", "A was involved."), draft("h2", "A was not.")],
      [ev("h1", "supports", both), ev("h2", "supports", both)],
    );
    expect(set.discriminatesNothing).toHaveLength(1);
    expect(set.discriminatesNothing[0]!.summary).toBe("It rained that night.");
    expect(discriminators(set.hypotheses[0]!, set.hypotheses[1]!)).toHaveLength(0);
  });

  it("does not call a record consistent with one of them undiscriminating", () => {
    const set = read(
      [draft("h1", "A was involved."), draft("h2", "A was not.")],
      [ev("h1", "supports", { sourceId: "s9", summary: "Only bears on h1." })],
    );
    expect(set.discriminatesNothing).toHaveLength(0);
  });

  // A question, never a guess at its answer.
  it("asks what would separate them when nothing does", () => {
    const set = read([draft("h1", "A was involved."), draft("h2", "A was not.")], []);
    const question = discriminatingQuestion(set.hypotheses[0]!, set.hypotheses[1]!);
    expect(question).toMatch(/Nothing in the case file separates/);
    expect(question).toMatch(/What could be found that only one of them survives\?/);
  });

  it("asks nothing when the record already separates them", () => {
    const shared = { sourceId: "s9", summary: "The vehicle was blue." };
    const set = read(
      [draft("h1", "A was involved."), draft("h2", "A was not.")],
      [ev("h1", "supports", shared), ev("h2", "contradicts", shared)],
    );
    expect(discriminatingQuestion(set.hypotheses[0]!, set.hypotheses[1]!)).toBeNull();
  });
});

describe("the skeptic", () => {
  const pair = [draft("h1", "Person A was involved."), draft("h2", "Person A was not involved.")];
  const find = (challenges: ReturnType<typeof runSkeptic>, id: string) =>
    challenges.find((challenge) => challenge.id === id)!;

  // The whole argument of the module: answer what the record can answer, and
  // refuse to pretend about the rest.
  it("marks the questions only a person can answer, with no answer attached", () => {
    const challenges = runSkeptic({ set: read(pair, []), sources: [] });
    const yours = challenges.filter((challenge) => challenge.kind === "yours");
    expect(yours.length).toBeGreaterThan(0);
    expect(yours.every((challenge) => challenge.finding === null)).toBe(true);
    expect(yours.map((c) => c.question)).toContain("Is the source reliable?");
  });

  it("names an explanation with no assumptions written down", () => {
    const set = read([pair[0]!, draft("h2", "A was not.", { assumptions: [] })], []);
    expect(find(runSkeptic({ set, sources: [] }), "assumptions").finding)
      .toMatch(/state no assumptions at all|states no assumptions at all/);
  });

  it("says nothing about assumptions when both state them", () => {
    expect(find(runSkeptic({ set: read(pair, []), sources: [] }), "assumptions").finding).toBeNull();
  });

  it("cannot tell a search that found nothing from a search nobody made", () => {
    const set = read(pair, [ev("h1", "supports")]);
    expect(find(runSkeptic({ set, sources: [] }), "untested").finding)
      .toMatch(/the case file cannot tell those apart/);
  });

  // Two sources with the same bytes are one source.
  it("names sources that are the same record twice", () => {
    const set = read(pair, []);
    const challenges = runSkeptic({
      set,
      sources: [
        { id: "s1", title: "The Herald", contentHash: "abc" },
        { id: "s2", title: "The Post", contentHash: "abc" },
      ],
    });
    expect(find(challenges, "independence").finding).toMatch(/identical content/);
  });

  it("names a source carrying more than half of a hypothesis", () => {
    const set = read(pair, [
      ev("h1", "supports", { sourceId: "s1", sourceTitle: "One witness" }),
      ev("h1", "supports", { sourceId: "s1", sourceTitle: "One witness" }),
      ev("h1", "supports", { sourceId: "s1", sourceTitle: "One witness" }),
      ev("h1", "supports", { sourceId: "s2", sourceTitle: "Another" }),
    ]);
    expect(find(runSkeptic({ set, sources: [] }), "dominance").finding)
      .toMatch(/comes from "One witness". If that source is wrong/);
  });

  it("says nothing about dominance when the support is spread", () => {
    const set = read(pair, [
      ev("h1", "supports", { sourceId: "s1" }),
      ev("h1", "supports", { sourceId: "s2" }),
      ev("h1", "supports", { sourceId: "s3" }),
    ]);
    expect(find(runSkeptic({ set, sources: [] }), "dominance").finding).toBeNull();
  });

  // The hardest thing to see from inside an investigation.
  it("names an explanation worked far harder than its rival", () => {
    const set = read(pair, [
      ev("h1", "supports"), ev("h1", "supports"), ev("h1", "supports"),
      ev("h1", "supports"), ev("h1", "contradicts"),
    ]);
    const finding = find(runSkeptic({ set, sources: [] }), "preference").finding;
    expect(finding).toMatch(/none bears/);
    expect(finding).toMatch(/where the looking went, not about which is true/);
  });

  it("says nothing about preference when both were worked", () => {
    const set = read(pair, [
      ev("h1", "supports"), ev("h1", "supports"), ev("h1", "contradicts"),
      ev("h2", "supports"), ev("h2", "supports"), ev("h2", "contradicts"),
    ]);
    expect(find(runSkeptic({ set, sources: [] }), "preference").finding).toBeNull();
  });

  it("says nothing about preference before enough has been gathered to be lopsided", () => {
    const set = read(pair, [ev("h1", "supports"), ev("h1", "supports")]);
    expect(find(runSkeptic({ set, sources: [] }), "preference").finding).toBeNull();
  });

  // "...depot at all.". An explanation" was the first generated report. Two
  // stops and a stray quote, the same defect a dossier shipped with once.
  it("does not double the full stop on a statement that brought one", () => {
    const set = read([pair[0]!, draft("h2", "A was not involved.", { assumptions: [] })], []);
    const finding = find(runSkeptic({ set, sources: [] }), "assumptions").finding ?? "";
    expect(finding).toContain('"A was not involved". An explanation');
    expect(finding).not.toMatch(/[.]"[.]/);
  });

  it("counts a third explanation as answering the alternatives question", () => {
    const three = read([...pair, draft("h3", "A third party explains it.")], []);
    expect(find(runSkeptic({ set: three, sources: [] }), "alternatives").finding).toBeNull();
    expect(find(runSkeptic({ set: read(pair, []), sources: [] }), "alternatives").finding)
      .toMatch(/the third is usually the one nobody wanted to write down/);
  });

  // It concludes nothing, the same refusal the dossier makes.
  it("never says which explanation is right", () => {
    const set = read(pair, [ev("h1", "supports"), ev("h1", "supports"), ev("h2", "contradicts")]);
    const text = JSON.stringify(runSkeptic({ set, sources: [] }));
    expect(text).not.toMatch(/we conclude|most likely|is guilty|proves|therefore Person/i);
  });
});
