import { describe, expect, it } from "vitest";
import { FRAMEWORK_IDS } from "./frameworks.ts";
import { diagnosticToolSchema, parseReport, SECTION_IDS } from "./report.ts";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    sections: SECTION_IDS.map((id) => ({
      id,
      summary: `summary for ${id}`,
      findings: [{ framework: "speech_act", claim: "a structural claim", quotes: ["a span"] }],
    })),
    ...overrides,
  };
}

describe("parsing a well-formed payload", () => {
  it("accepts one and keeps the findings", () => {
    const result = parseReport(payload(), "decode");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.sections).toHaveLength(SECTION_IDS.length);
    expect(result.report.sections[0]?.findings[0]?.framework).toBe("speech_act");
  });

  it("puts the sections into render order regardless of how they arrived", () => {
    const shuffled = payload({
      sections: [...SECTION_IDS]
        .reverse()
        .map((id) => ({ id, summary: `s ${id}`, findings: [] })),
    });
    const result = parseReport(shuffled, "decode");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.sections.map((s) => s.id)).toEqual([...SECTION_IDS]);
  });

  it("tolerates a section with no findings — an absence is a legitimate result", () => {
    const sparse = payload({
      sections: SECTION_IDS.map((id) => ({ id, summary: `s ${id}`, findings: [] })),
    });
    expect(parseReport(sparse, "decode").ok).toBe(true);
  });
});

// Negative controls. Each of these is a way the model has to be able to fail
// without a malformed report reaching a screen.
describe("refusing a malformed payload", () => {
  it("refuses a finding citing no known framework", () => {
    const bad = payload({
      sections: SECTION_IDS.map((id) => ({
        id,
        summary: `s ${id}`,
        findings: [{ framework: "general communication principles", claim: "c", quotes: [] }],
      })),
    });
    const result = parseReport(bad, "decode");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.join(" ")).toContain("not a known framework");
  });

  it("refuses a missing section", () => {
    const bad = payload({
      sections: SECTION_IDS.slice(0, 2).map((id) => ({ id, summary: "s", findings: [] })),
    });
    const result = parseReport(bad, "decode");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.includes("is missing"))).toBe(true);
  });

  it("refuses a duplicated section", () => {
    const bad = payload({
      sections: [...SECTION_IDS, "act"].map((id) => ({ id, summary: "s", findings: [] })),
    });
    const result = parseReport(bad, "decode");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.includes("duplicated"))).toBe(true);
  });

  it("refuses an empty summary", () => {
    const bad = payload({
      sections: SECTION_IDS.map((id) => ({ id, summary: "   ", findings: [] })),
    });
    expect(parseReport(bad, "decode").ok).toBe(false);
  });

  it("refuses draft mode with no rewrite", () => {
    const result = parseReport(payload(), "draft");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("rewrite is missing in draft mode");
  });

  it("accepts draft mode with one", () => {
    const result = parseReport(
      payload({ rewrite: { text: "a revised message", note: "what changed" } }),
      "draft",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.rewrite?.text).toBe("a revised message");
  });

  it.each([[null], [42], ["a string"], [[]]])("refuses the non-object %p", (value) => {
    expect(parseReport(value, "decode").ok).toBe(false);
  });
});

describe("the tool schema", () => {
  it("pins framework to the closed enum, so an unattributed finding is not expressible", () => {
    const schema = diagnosticToolSchema("decode") as Record<string, never>;
    const framework = JSON.parse(JSON.stringify(schema)).properties.sections.items.properties
      .findings.items.properties.framework;
    expect(framework.enum).toEqual([...FRAMEWORK_IDS]);
  });

  it("requires a rewrite in draft mode and forbids one in decode", () => {
    const draft = JSON.parse(JSON.stringify(diagnosticToolSchema("draft")));
    const decode = JSON.parse(JSON.stringify(diagnosticToolSchema("decode")));
    expect(draft.required).toContain("rewrite");
    expect(decode.required).not.toContain("rewrite");
    expect(decode.properties.rewrite).toBeUndefined();
  });

  it("asks for exactly the four sections", () => {
    const schema = JSON.parse(JSON.stringify(diagnosticToolSchema("decode")));
    expect(schema.properties.sections.minItems).toBe(SECTION_IDS.length);
    expect(schema.properties.sections.items.properties.id.enum).toEqual([...SECTION_IDS]);
  });
});
