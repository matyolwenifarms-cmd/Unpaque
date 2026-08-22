import { describe, expect, it } from "vitest";
import { guardReport } from "./guard.ts";
import { parseReport, SECTION_IDS } from "./report.ts";
import { stubReport } from "./stub.ts";

// The stub does not read this, and its own prose says so — but its annotation
// is an offset, so it needs a real text to be an offset into.
const SOURCE =
  "Following a review of current operating conditions, a decision has been made to consolidate several roles.";

describe("the stub report", () => {
  it.each([["decode"], ["draft"]] as const)("satisfies the parser in %s mode", (mode) => {
    // Round-tripped through the parser rather than merely typed: the stub has
    // to survive the same gate a real payload does, so a change to the contract
    // cannot leave it behind still compiling but no longer valid.
    const result = parseReport(JSON.parse(JSON.stringify(stubReport(mode, SOURCE))), mode, SOURCE);
    expect(result.ok).toBe(true);
  });

  it.each([["decode"], ["draft"]] as const)("stays inside the boundary in %s mode", (mode) => {
    expect(guardReport(stubReport(mode, SOURCE))).toEqual([]);
  });

  it("carries all four sections", () => {
    expect(stubReport("decode", SOURCE).sections.map((s) => s.id)).toEqual([...SECTION_IDS]);
  });

  it("has no rewrite in decode mode and one in draft", () => {
    expect(stubReport("decode", SOURCE).rewrite).toBeUndefined();
    expect(stubReport("draft", SOURCE).rewrite).toBeDefined();
  });

  // The honesty requirement, asserted rather than trusted. Someone redesigning
  // this copy must not be able to quietly remove the disclosure.
  it("says it is not an analysis, in the first section", () => {
    const first = stubReport("decode", SOURCE).sections[0]!;
    expect(first.summary.toLowerCase()).toContain("has not read the text you submitted");
  });

  it("never claims to have found something in the submitted text", () => {
    const quotes = stubReport("draft", SOURCE).sections.flatMap((s) => s.findings.flatMap((f) => f.quotes));
    for (const quote of quotes) {
      expect(quote).toMatch(/would appear here/);
    }
  });
});

describe("the stub announces itself", () => {
  // House rule: a placeholder must announce itself. The stub produces an
  // annotation because the annotated view is the main thing it exists to
  // exercise — and an annotation is a claim that this phrase does that thing,
  // which the stub is in no position to make.
  it("says in the verdict that nothing was read", () => {
    expect(stubReport("decode", SOURCE).verdict).toMatch(/has not read the text you submitted/i);
  });

  it("says in the note that the span was chosen by counting", () => {
    const [annotation] = stubReport("decode", SOURCE).annotations;
    expect(annotation).toBeDefined();
    expect(annotation!.note).toMatch(/chosen by counting characters, not by reading/i);
  });

  it("still produces a span that points at real, whole words", () => {
    const [annotation] = stubReport("decode", SOURCE).annotations;
    const slice = SOURCE.slice(annotation!.start, annotation!.end);
    expect(slice.trim()).not.toBe("");
    // Ends on a boundary, which is what the parser requires and what makes
    // this fixture exercise the real path rather than a lenient one.
    expect(SOURCE[annotation!.end] ?? " ").toMatch(/[^\p{L}\p{N}]/u);
  });

  it("annotates nothing at all when there is nothing to annotate", () => {
    expect(stubReport("decode", "hi").annotations).toEqual([]);
  });
});
