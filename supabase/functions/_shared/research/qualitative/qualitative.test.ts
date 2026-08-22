import { describe, expect, it } from "vitest";
import { byCategory, codeProblems, type Code } from "./codebook.ts";
import {
  coOccurrence,
  codingProblems,
  extractOf,
  layers,
  toWholeWords,
  type Coding,
} from "./coding.ts";
import { assembleThemes, reachOf, uncoveredCodes, type ThemeDraft } from "./themes.ts";
import { readSaturation } from "./saturation.ts";

const code = (id: string, label: string, over: Partial<Code> = {}): Code => ({
  id, label,
  definition: `Where a participant speaks about ${label}.`,
  when: `Applied to any passage about ${label}.`,
  notWhen: `Not applied to passing mentions with no elaboration.`,
  ...over,
});

const coding = (id: string, documentId: string, codeId: string, start: number, end: number,
                over: Partial<Coding> = {}): Coding => ({ id, documentId, codeId, start, end, ...over });

const TEXT = "The cost was the first thing everyone mentioned, and nobody trusted the process at all.";

describe("the codebook", () => {
  // The field that makes a codebook usable by a second coder, and the one that
  // gets left out.
  it("refuses a code with no exclusion", () => {
    const problems = codeProblems({ label: "Cost", definition: "About money.", when: "Any mention." });
    expect(problems.map((problem) => problem.field)).toContain("notWhen");
    expect(problems.find((problem) => problem.field === "notWhen")?.says)
      .toMatch(/near-misses/);
  });

  it("accepts a complete one", () => {
    expect(codeProblems(code("c1", "cost"))).toEqual([]);
  });

  it("names each missing part rather than refusing wholesale", () => {
    const problems = codeProblems({});
    expect(problems.map((problem) => problem.field).sort())
      .toEqual(["definition", "label", "notWhen", "when"]);
  });

  // A tree deeper than this becomes a filing system the analyst navigates
  // instead of an analysis they think with.
  it("allows one level of grouping and refuses two", () => {
    const category = code("cat", "Barriers");
    const child = code("c1", "cost", { parentId: "cat" });
    expect(codeProblems(child, [category])).toEqual([]);
    const grandchild = code("c2", "hidden cost", { parentId: "c1" });
    expect(codeProblems(grandchild, [category, child])[0]?.says)
      .toMatch(/is itself inside a category/);
  });

  it("refuses a parent that does not exist", () => {
    expect(codeProblems(code("c1", "cost", { parentId: "nope" }), [])[0]?.says)
      .toMatch(/does not exist/);
  });

  // Silently hiding it would remove coded data from the analysis without
  // saying so.
  it("keeps a code whose category was deleted, rather than losing it", () => {
    const orphan = code("c1", "cost", { parentId: "deleted" });
    const groups = byCategory([code("cat", "Barriers"), orphan]);
    expect(groups.at(-1)?.category).toBeNull();
    expect(groups.at(-1)?.codes).toContainEqual(orphan);
  });

  it("groups a category with its children, the category included", () => {
    const category = code("cat", "Barriers");
    const child = code("c1", "cost", { parentId: "cat" });
    const groups = byCategory([category, child]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.category).toEqual(category);
    expect(groups[0]!.codes).toEqual([category, child]);
  });

  // The invariant a first version broke: a top-level code with no children
  // rendered as a heading above an empty list - in the codebook, and invisible
  // as a code. Caught by a component test, not by this suite, which is why the
  // property is asserted here rather than the shape of one case.
  it("shows every code exactly once, whatever the hierarchy", () => {
    const all = [
      code("cat", "Barriers"),
      code("c1", "cost", { parentId: "cat" }),
      code("c2", "trust", { parentId: "cat" }),
      code("lone", "time"),
      code("orphan", "access", { parentId: "deleted" }),
    ];
    const shown = byCategory(all).flatMap((group) => group.codes.map((code) => code.id));
    expect([...shown].sort()).toEqual(["c1", "c2", "cat", "lone", "orphan"]);
    expect(new Set(shown).size).toBe(shown.length);
  });
});

describe("applying a code", () => {
  it("accepts a passage and slices it from the document", () => {
    const applied = coding("g1", "d1", "c1", 4, 8);
    expect(codingProblems(applied, TEXT)).toEqual([]);
    expect(extractOf(applied, TEXT)).toBe("cost");
  });

  it("refuses a selection outside the document", () => {
    expect(codingProblems({ start: 0, end: TEXT.length + 20 }, TEXT)[0]?.kind).toBe("out_of_bounds");
  });

  it("refuses an empty selection", () => {
    expect(codingProblems({ start: 3, end: 4 }, TEXT)[0]?.kind).toBe("empty");
  });

  // A code applied to everything stops distinguishing anything.
  it("refuses a code applied to the whole document, and says why", () => {
    const problems = codingProblems({ start: 0, end: TEXT.length }, TEXT);
    expect(problems.some((problem) => problem.kind === "whole_document")).toBe(true);
    expect(problems.find((problem) => problem.kind === "whole_document")?.says)
      .toMatch(/stops distinguishing anything/);
  });

  // A human dragging a selection has said what they mean; the boundary is a
  // slip. Widened rather than refused, unlike a model returning offsets.
  it("widens a dragged selection to whole words", () => {
    const { start, end } = toWholeWords(TEXT, 5, 7);
    expect(TEXT.slice(start, end)).toBe("cost");
  });

  it("leaves a selection already on word boundaries alone", () => {
    expect(toWholeWords(TEXT, 4, 8)).toEqual({ start: 4, end: 8 });
  });

  // Qualitative coding routinely applies two codes to the same words.
  it("allows two codes over the same passage", () => {
    const first = coding("g1", "d1", "cost", 4, 8);
    const second = coding("g2", "d1", "trust", 4, 8);
    expect(codingProblems(first, TEXT)).toEqual([]);
    expect(codingProblems(second, TEXT)).toEqual([]);
    expect(coOccurrence([first, second])).toEqual([{ a: "cost", b: "trust", count: 1 }]);
  });

  it("counts a pair once, not once per direction", () => {
    const pairs = coOccurrence([
      coding("g1", "d1", "trust", 0, 20),
      coding("g2", "d1", "cost", 4, 8),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({ a: "cost", b: "trust", count: 1 });
  });

  it("does not pair codings in different documents, or codings that do not overlap", () => {
    expect(coOccurrence([
      coding("g1", "d1", "cost", 4, 8),
      coding("g2", "d2", "trust", 4, 8),
    ])).toEqual([]);
    expect(coOccurrence([
      coding("g1", "d1", "cost", 0, 4),
      coding("g2", "d1", "trust", 10, 14),
    ])).toEqual([]);
  });
});

describe("themes exist only where there are extracts", () => {
  const codes = [code("cost", "cost"), code("trust", "trust"), code("time", "time")];
  const documents = new Map([["d1", TEXT], ["d2", TEXT]]);
  const codings = [
    coding("g1", "d1", "cost", 4, 8),
    coding("g2", "d2", "cost", 4, 8),
    coding("g3", "d1", "trust", 62, 69),
  ];

  it("assembles a theme from its codes and shows the extracts", () => {
    const draft: ThemeDraft = {
      id: "t1", label: "What stops people", statement: "Two barriers recur.",
      codeIds: ["cost", "trust"],
    };
    const { themes } = assembleThemes([draft], codes, codings, documents);
    expect(themes).toHaveLength(1);
    expect(themes[0]!.extracts).toHaveLength(3);
    expect(themes[0]!.extracts.map((extract) => extract.text)).toContain("cost");
    expect(themes[0]!.documents).toBe(2);
  });

  // The rule this module is about: a themes chapter written first and
  // evidenced afterwards is the commonest failure in qualitative work.
  it("refuses to return a theme nothing is coded to", () => {
    const draft: ThemeDraft = { id: "t1", label: "Time pressure", statement: "x", codeIds: ["time"] };
    const { themes, withoutEvidence } = assembleThemes([draft], codes, codings, documents);
    expect(themes).toEqual([]);
    expect(withoutEvidence[0]?.says).toMatch(/has no extracts and does not exist yet/);
  });

  // A researcher who cannot find their theme will assume the software lost it.
  it("says why, rather than dropping it silently", () => {
    const draft: ThemeDraft = { id: "t1", label: "Nothing", statement: "x", codeIds: [] };
    const { withoutEvidence } = assembleThemes([draft], codes, codings, documents);
    expect(withoutEvidence[0]?.says).toMatch(/A theme is assembled from codes/);
  });

  // It may be the most interesting thing in the study. The point is to stop it
  // being reported as though several people said it.
  it("says when a theme rests on one document", () => {
    const draft: ThemeDraft = { id: "t1", label: "Trust", statement: "x", codeIds: ["trust"] };
    const { themes } = assembleThemes([draft], codes, codings, documents);
    expect(reachOf(themes[0]!)).toMatch(/one document.*not a pattern across the sample/);
  });

  it("reports reach plainly when several documents contribute", () => {
    const draft: ThemeDraft = { id: "t1", label: "Cost", statement: "x", codeIds: ["cost"] };
    const { themes } = assembleThemes([draft], codes, codings, documents);
    expect(reachOf(themes[0]!)).toMatch(/2 extracts across 2 documents/);
  });

  // The codes left out are exactly the ones that did not fit the story.
  it("names coded material no theme has gathered", () => {
    const draft: ThemeDraft = { id: "t1", label: "Cost", statement: "x", codeIds: ["cost"] };
    const { themes } = assembleThemes([draft], codes, codings, documents);
    expect(uncoveredCodes(themes, codes, codings).map((c) => c.id)).toEqual(["trust"]);
  });

  it("does not name a code nothing was ever coded to", () => {
    expect(uncoveredCodes([], codes, codings).map((c) => c.id)).toEqual(["cost", "trust"]);
  });
});

describe("laying codings over the text", () => {
  it("returns the whole document when nothing is coded", () => {
    const pieces = layers(TEXT, []);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.text).toBe(TEXT);
    expect(pieces[0]!.codeIds).toEqual([]);
  });

  it("reassembles into exactly the source, always", () => {
    const pieces = layers(TEXT, [
      coding("g1", "d1", "cost", 4, 8),
      coding("g2", "d1", "trust", 62, 69),
    ]);
    expect(pieces.map((piece) => piece.text).join("")).toBe(TEXT);
  });

  // The case `segments()` in the diagnostic refuses outright, and the reason
  // this function exists at all.
  it("carries both codes on the stretch two codings share", () => {
    const pieces = layers(TEXT, [
      coding("g1", "d1", "cost", 0, 30),
      coding("g2", "d1", "trust", 20, 50),
    ]);
    expect(pieces.map((piece) => piece.text).join("")).toBe(TEXT);
    const shared = pieces.find((piece) => piece.start === 20)!;
    expect(shared.end).toBe(30);
    expect(shared.codeIds).toEqual(["cost", "trust"]);
    expect(pieces.find((piece) => piece.start === 0)!.codeIds).toEqual(["cost"]);
    expect(pieces.find((piece) => piece.start === 30)!.codeIds).toEqual(["trust"]);
  });

  it("nests a coding that sits inside another", () => {
    const pieces = layers(TEXT, [
      coding("g1", "d1", "cost", 0, 40),
      coding("g2", "d1", "trust", 10, 20),
    ]);
    const inner = pieces.find((piece) => piece.start === 10)!;
    // Outer first: the innermost code is the last one, which is what a reader
    // needs to know is the tightest claim about that phrase.
    expect(inner.codeIds).toEqual(["cost", "trust"]);
    expect(inner.codingIds).toEqual(["g1", "g2"]);
  });

  it("ignores a coding that does not fit the document", () => {
    const pieces = layers(TEXT, [coding("g1", "d1", "cost", 4, TEXT.length + 40)]);
    expect(pieces.map((piece) => piece.text).join("")).toBe(TEXT);
    expect(pieces.every((piece) => piece.codeIds.length === 0)).toBe(true);
  });
});

describe("saturation, from the record rather than from confidence", () => {
  const codings = [
    coding("g1", "d1", "cost", 4, 8),
    coding("g2", "d1", "trust", 62, 69),
    coding("g3", "d2", "time", 4, 8),
    coding("g4", "d3", "cost", 4, 8),
    coding("g5", "d4", "trust", 4, 8),
  ];

  it("counts the documents since the last new code", () => {
    const reading = readSaturation(codings, ["d1", "d2", "d3", "d4"]);
    expect(reading.lastNewCodeIn).toBe("d2");
    expect(reading.documentsWithoutNewCodes).toBe(2);
    expect(reading.account).toMatch(/last new code appeared in the 2nd document/);
    expect(reading.account).toMatch(/the 2 documents coded after it produced no codes/);
  });

  // The sentence is written to be carried into a methodology chapter, so it is
  // asserted whole rather than by fragments. "1 document(s) were coded" got
  // through every fragment check there was.
  it("writes a sentence somebody could paste into a chapter", () => {
    expect(readSaturation(codings, ["d1", "d2", "d3", "d4"]).account).toBe(
      "4 documents were coded in sequence, producing 3 codes in total. The last new code " +
        "appeared in the 2nd document; the 2 documents coded after it produced no codes that " +
        "were not already in the frame. Whether that is sufficient for this study is a " +
        "judgement about the question and the field, not a threshold.",
    );
  });

  it("inflects for a single document and a single code", () => {
    const one = readSaturation([coding("g1", "d1", "cost", 4, 8)], ["d1"]);
    expect(one.account).toBe(
      "1 document was coded, producing 1 code. The most recently coded document still " +
        "produced codes not seen before, so coding has not stopped yielding new categories.",
    );
  });

  it("inflects for exactly one document after the last new code", () => {
    const account = readSaturation(codings, ["d1", "d2", "d3"]).account;
    expect(account).toMatch(/the document coded after it produced no codes/);
    expect(account).not.toMatch(/\(s\)|the 1 document/);
  });

  // The one state that says plainly: not yet. The order matters and not the
  // ids: read this way d2 comes last, and "time" is a code no earlier
  // document produced.
  it("says so when the most recent document still produced something new", () => {
    const reading = readSaturation(codings, ["d1", "d3", "d4", "d2"]);
    expect(reading.lastNewCodeIn).toBe("d2");
    expect(reading.documentsWithoutNewCodes).toBe(0);
    expect(reading.account).toMatch(/has not stopped yielding new categories/);
  });

  // Inferring the sequence from ids would be a guess presented as a fact about
  // how the analysis proceeded.
  it("refuses to assess saturation with no recorded order", () => {
    expect(readSaturation(codings, []).account).toMatch(/order .* is not recorded/);
  });

  it("says there is nothing to assess before any coding", () => {
    expect(readSaturation([], ["d1"]).account).toMatch(/No codes have been applied yet/);
  });

  // Whether the count is enough is a judgement about the field and the
  // question, and Braun and Clarke argue the concept does not travel to every
  // design at all.
  it("never declares saturation reached", () => {
    const reading = readSaturation(codings, ["d1", "d2", "d3", "d4"]);
    expect(reading.account).not.toMatch(/saturation was reached|saturation is reached/i);
    expect(reading.account).toMatch(/judgement about the question and the field, not a threshold/);
  });
});
