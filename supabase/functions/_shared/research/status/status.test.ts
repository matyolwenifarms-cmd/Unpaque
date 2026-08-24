import { describe, expect, it } from "vitest";
import { RESEARCH_STAGES, stageName } from "./stages.ts";
import { EMPTY, readStatus, type StudySnapshot } from "./status.ts";

const study = (over: Partial<StudySnapshot> = {}): StudySnapshot => ({ ...EMPTY, ...over });
const said = (snapshot: StudySnapshot) =>
  readStatus(snapshot).holds.map((line) => line.says).join(" ");

describe("a study with nothing in it", () => {
  it("holds nothing, and says so by saying nothing", () => {
    expect(readStatus(EMPTY).holds).toEqual([]);
  });

  it("offers the one thing that asks nothing of somebody new", () => {
    expect(readStatus(EMPTY).next?.stage).toBe("proposal");
    expect(readStatus(EMPTY).next?.says).toContain("Hand over a proposal");
  });
});

describe("only what is there is said", () => {
  // The decision the whole panel rests on. Most research never screens, never
  // runs a t-test and never holds a corpus; a panel listing everything undone
  // is a to-do list the researcher did not write.
  it("says nothing at all about the stages this study does not use", () => {
    const qualitative = study({ documents: 3, codes: 8, codings: 40, themes: 2 });
    const prose = said(qualitative);
    expect(prose).not.toMatch(/screen/i);
    expect(prose).not.toMatch(/analys/i);
    expect(prose).not.toMatch(/paper/i);
    expect(prose).not.toMatch(/reference/i);
  });

  it("never names a stage with nothing behind it", () => {
    const status = readStatus(study({ papers: 4 }));
    expect(status.holds.map((line) => line.stage)).toEqual(["papers"]);
  });

  it("every line points somewhere that exists", () => {
    const busy = study({
      references: 12, papers: 5, relations: 2, screened: 40, screeningIncluded: 6,
      paradigmDeclared: true, documents: 2, codes: 9, codings: 55, themes: 3, analyses: 4,
    });
    const ids = RESEARCH_STAGES.map((one) => one.id);
    for (const line of readStatus(busy).holds) {
      expect(ids).toContain(line.stage);
      expect(stageName(line.stage).length).toBeGreaterThan(0);
    }
  });
});

describe("what the lines actually say", () => {
  it("describes the corpus, and names scans as a limit rather than a fault", () => {
    expect(said(study({ papers: 12, papersWithoutText: 2 })))
      .toContain("2 of them have no text layer");
    expect(said(study({ papers: 12, papersWithoutText: 2 })))
      .toContain("cannot be searched or quoted");
    expect(said(study({ papers: 12 }))).toBe("12 papers held, with their text.");
  });

  it("inflects, down to the awkward ones", () => {
    // The awkward case: one paper, and it is the scan. "One of them" is about
    // a them that does not exist.
    expect(said(study({ papers: 1, papersWithoutText: 1 })))
      .toBe("1 paper held, and it has no text layer, so it cannot be searched or quoted.");
    expect(said(study({ papers: 6, papersWithoutText: 1 }))).toContain("One of them has");
    expect(said(study({ papers: 6, papersWithoutText: 3 }))).toContain("3 of them have");
    expect(said(study({ analyses: 1 }))).toContain("1 analysis run");
    expect(said(study({ analyses: 3 }))).toContain("3 analyses run");
  });

  it("says a codebook with nothing coded against it is exactly that", () => {
    expect(said(study({ documents: 1, codes: 4 })))
      .toContain("4 codes written, and nothing coded against them yet");
  });

  // A count is not a problem. Colouring forty papers as something needing
  // attention is how somebody learns to ignore the colour.
  it("marks only a waiting decision for attention, never a count", () => {
    const busy = readStatus(study({ papers: 40, relations: 20, references: 60, analyses: 9 }));
    expect(busy.holds.every((line) => line.tone === "holds")).toBe(true);

    const waiting = readStatus(study({ screened: 50, screeningUndecided: 30 }));
    expect(waiting.holds.find((line) => line.stage === "screening")?.tone).toBe("attention");
  });

  it("stops calling screening attention once every record is decided", () => {
    const done = readStatus(study({ screened: 50, screeningIncluded: 8 }));
    expect(done.holds.find((line) => line.stage === "screening")?.tone).toBe("holds");
    expect(said(study({ screened: 50, screeningIncluded: 8 }))).toContain("8 included");
  });
});

describe("the one thing offered next", () => {
  it("puts a waiting decision above everything else", () => {
    const status = readStatus(study({ papers: 9, screened: 40, screeningUndecided: 12 }));
    expect(status.next?.stage).toBe("screening");
    expect(status.next?.says).toContain("12 records are waiting");
  });

  it("offers the comparison once there are papers to compare", () => {
    expect(readStatus(study({ papers: 2 })).next?.stage).toBe("papers");
    // One paper cannot disagree with anything.
    expect(readStatus(study({ papers: 1 })).next?.stage).not.toBe("papers");
  });

  it("stops offering it once relations have been recorded", () => {
    expect(readStatus(study({ papers: 9, relations: 1 })).next?.stage).not.toBe("papers");
  });

  it("offers the corpus when there are references and no papers", () => {
    const status = readStatus(study({ references: 12 }));
    expect(status.next?.stage).toBe("papers");
    expect(status.next?.says).toContain("references but none of the papers themselves");
  });

  it("offers a codebook when a document is open and there is none", () => {
    expect(readStatus(study({ documents: 1 })).next?.stage).toBe("code");
  });

  // The honest answer when nothing in the study implies a next step. Inventing
  // one would be a claim about somebody's research that this is in no position
  // to make.
  it("offers nothing rather than inventing a step", () => {
    const settled = study({
      references: 20, papers: 6, relations: 4, paradigmDeclared: true,
      documents: 2, codes: 9, codings: 55, themes: 3, analyses: 2,
    });
    expect(readStatus(settled).next).toBeNull();
  });

  it("phrases it as an offer rather than an instruction", () => {
    for (const snapshot of [EMPTY, study({ papers: 2 }), study({ documents: 1 })]) {
      const next = readStatus(snapshot).next;
      if (next === null) continue;
      expect(next.says).not.toMatch(/^(You should|You must|Now |Next,)/);
    }
  });
});

describe("the stage list", () => {
  it("is the one both the page and the status panel read", () => {
    expect(RESEARCH_STAGES.map((one) => one.id)).toEqual([
      "proposal", "literature", "papers", "screening",
      "method", "analyse", "code", "writeup",
    ]);
  });

  it("gives every stage a name to show", () => {
    for (const stage of RESEARCH_STAGES) {
      expect(stageName(stage.id)).toBe(stage.name);
      expect(stage.blurb.length).toBeGreaterThan(10);
    }
  });
});
