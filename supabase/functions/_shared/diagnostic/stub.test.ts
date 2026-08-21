import { describe, expect, it } from "vitest";
import { guardReport } from "./guard.ts";
import { parseReport, SECTION_IDS } from "./report.ts";
import { stubReport } from "./stub.ts";

describe("the stub report", () => {
  it.each([["decode"], ["draft"]] as const)("satisfies the parser in %s mode", (mode) => {
    // Round-tripped through the parser rather than merely typed: the stub has
    // to survive the same gate a real payload does, so a change to the contract
    // cannot leave it behind still compiling but no longer valid.
    const result = parseReport(JSON.parse(JSON.stringify(stubReport(mode))), mode);
    expect(result.ok).toBe(true);
  });

  it.each([["decode"], ["draft"]] as const)("stays inside the boundary in %s mode", (mode) => {
    expect(guardReport(stubReport(mode))).toEqual([]);
  });

  it("carries all four sections", () => {
    expect(stubReport("decode").sections.map((s) => s.id)).toEqual([...SECTION_IDS]);
  });

  it("has no rewrite in decode mode and one in draft", () => {
    expect(stubReport("decode").rewrite).toBeUndefined();
    expect(stubReport("draft").rewrite).toBeDefined();
  });

  // The honesty requirement, asserted rather than trusted. Someone redesigning
  // this copy must not be able to quietly remove the disclosure.
  it("says it is not an analysis, in the first section", () => {
    const first = stubReport("decode").sections[0]!;
    expect(first.summary.toLowerCase()).toContain("has not read the text you submitted");
  });

  it("never claims to have found something in the submitted text", () => {
    const quotes = stubReport("draft").sections.flatMap((s) => s.findings.flatMap((f) => f.quotes));
    for (const quote of quotes) {
      expect(quote).toMatch(/would appear here/);
    }
  });
});
