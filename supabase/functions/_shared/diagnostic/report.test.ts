import { describe, expect, it } from "vitest";
import { FRAMEWORK_IDS } from "./frameworks.ts";
import { diagnosticToolSchema, parseReport, SECTION_IDS } from "./report.ts";

// Annotations are offsets, so the fixtures need a real text to point into.
const SOURCE =
  "Following a review of current operating conditions, a decision has been made " +
  "to consolidate several roles. Regrettably, a number of positions will be impacted.";

const spanOf = (phrase: string) => {
  const start = SOURCE.indexOf(phrase);
  if (start < 0) throw new Error(`fixture error: "${phrase}" is not in SOURCE`);
  return { start, end: start + phrase.length };
};

function payload(overrides: Record<string, unknown> = {}) {
  return {
    verdict: "The message reports an outcome without naming who decided it.",
    annotations: [{
      ...spanOf("a decision has been made"),
      device: "agentless_framing",
      framework: "critical_discourse",
      aspect: "responsibility",
      note: "The passive construction reports the outcome without naming who chose it.",
    }],
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
    const result = parseReport(payload(), "decode", SOURCE);
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
    const result = parseReport(shuffled, "decode", SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.sections.map((s) => s.id)).toEqual([...SECTION_IDS]);
  });

  it("tolerates a section with no findings — an absence is a legitimate result", () => {
    const sparse = payload({
      sections: SECTION_IDS.map((id) => ({ id, summary: `s ${id}`, findings: [] })),
    });
    expect(parseReport(sparse, "decode", SOURCE).ok).toBe(true);
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
    const result = parseReport(bad, "decode", SOURCE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.join(" ")).toContain("not a known framework");
  });

  it("refuses a missing section", () => {
    const bad = payload({
      sections: SECTION_IDS.slice(0, 2).map((id) => ({ id, summary: "s", findings: [] })),
    });
    const result = parseReport(bad, "decode", SOURCE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.includes("is missing"))).toBe(true);
  });

  it("refuses a duplicated section", () => {
    const bad = payload({
      sections: [...SECTION_IDS, "act"].map((id) => ({ id, summary: "s", findings: [] })),
    });
    const result = parseReport(bad, "decode", SOURCE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.includes("duplicated"))).toBe(true);
  });

  it("refuses an empty summary", () => {
    const bad = payload({
      sections: SECTION_IDS.map((id) => ({ id, summary: "   ", findings: [] })),
    });
    expect(parseReport(bad, "decode", SOURCE).ok).toBe(false);
  });

  it("refuses draft mode with no rewrite", () => {
    const result = parseReport(payload(), "draft", SOURCE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("rewrite is missing in draft mode");
  });

  it("accepts draft mode with one", () => {
    const result = parseReport(
      payload({ rewrite: { text: "a revised message", note: "what changed" } }),
      "draft",
      SOURCE,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.rewrite?.text).toBe("a revised message");
  });

  it.each([[null], [42], ["a string"], [[]]])("refuses the non-object %p", (value) => {
    expect(parseReport(value, "decode", SOURCE).ok).toBe(false);
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

  it("names exactly the four sections in the id enum", () => {
    const schema = JSON.parse(JSON.stringify(diagnosticToolSchema("decode")));
    expect(schema.properties.sections.items.properties.id.enum).toEqual([...SECTION_IDS]);
  });

  // The count used to be a minItems/maxItems pair on the array. Strict mode
  // rejects those, so the requirement moved to the parser — which is where it
  // belonged anyway, since "section \"framing\" is missing" is a better thing
  // to read than a schema violation.
  it("leaves the count to the parser, which names what is missing", () => {
    const short = {
      sections: SECTION_IDS.slice(0, 3).map((id) => ({ id, summary: "s", findings: [] })),
    };
    const result = parseReport(short, "decode", SOURCE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain(`section "${SECTION_IDS[3]}" is missing`);
  });
});

// Strict tool use accepts a documented subset of JSON Schema and rejects the
// rest with a 400. The SDKs strip unsupported keywords client-side, which is
// worse than an error: the schema in the source then claims a constraint the
// API never enforced. This walks the schema and refuses the keywords outright.
describe("the tool schema stays inside what strict mode accepts", () => {
  const UNSUPPORTED = [
    "minItems", "maxItems", "uniqueItems", "contains",
    "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
    "minLength", "maxLength", "pattern",
    "minProperties", "maxProperties", "patternProperties", "propertyNames",
    "if", "then", "else", "not", "oneOf", "dependentSchemas",
  ];

  function walk(node: unknown, path: string, found: string[]): void {
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${path}[${i}]`, found));
      return;
    }
    if (typeof node !== "object" || node === null) return;
    for (const [key, value] of Object.entries(node)) {
      if (UNSUPPORTED.includes(key)) found.push(`${path}.${key}`);
      walk(value, `${path}.${key}`, found);
    }
  }

  it.each([["decode"], ["draft"]] as const)("uses no unsupported keyword in %s mode", (mode) => {
    const found: string[] = [];
    walk(diagnosticToolSchema(mode), "schema", found);
    expect(found).toEqual([]);
  });

  it("sets additionalProperties: false on every object, as strict mode requires", () => {
    const missing: string[] = [];
    function check(node: unknown, path: string): void {
      if (Array.isArray(node)) return node.forEach((c, i) => check(c, `${path}[${i}]`));
      if (typeof node !== "object" || node === null) return;
      const record = node as Record<string, unknown>;
      if (record.type === "object" && record.additionalProperties !== false) missing.push(path);
      for (const [key, value] of Object.entries(record)) check(value, `${path}.${key}`);
    }
    check(diagnosticToolSchema("draft"), "schema");
    expect(missing).toEqual([]);
  });

  // The negative control: the walker must actually find something when there
  // is something to find, or the two tests above are decorative.
  it("detects an unsupported keyword when one is present", () => {
    const found: string[] = [];
    walk({ type: "array", minItems: 4, items: { type: "string" } }, "fixture", found);
    expect(found).toEqual(["fixture.minItems"]);
  });
});

describe("the verdict and the anchoring, through the parser", () => {
  it("keeps the verdict and the annotation", () => {
    const result = parseReport(payload(), "decode", SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.verdict).toMatch(/without naming who decided it/);
    expect(result.report.annotations).toHaveLength(1);
    const [first] = result.report.annotations;
    expect(SOURCE.slice(first!.start, first!.end)).toBe("a decision has been made");
  });

  it("refuses a payload with no verdict", () => {
    const result = parseReport(payload({ verdict: "  " }), "decode", SOURCE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("verdict is empty");
  });

  // The offsets are checked against the text, not merely for being numbers.
  // A parser that took only the payload could confirm an annotation's shape
  // and nothing about whether it points at anything.
  it("refuses an annotation pointing outside the text", () => {
    const result = parseReport(
      payload({ annotations: [{ ...payload().annotations[0], end: SOURCE.length + 50 }] }),
      "decode",
      SOURCE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(" ")).toMatch(/points outside the text/);
  });

  it("refuses a device outside the enum", () => {
    const result = parseReport(
      payload({ annotations: [{ ...payload().annotations[0], device: "vibes" }] }),
      "decode",
      SOURCE,
    );
    expect(result.ok).toBe(false);
  });
});

describe("the schema the model is handed", () => {
  // The absence is the mechanism: with no field for the phrase, a highlighted
  // span is necessarily sliced from the source. Adding `text` "so the model can
  // show its working" would hand back exactly what this design removes.
  it("gives an annotation no field a phrase could be written into", () => {
    const schema = diagnosticToolSchema("decode") as never as {
      properties: { annotations: { items: { properties: Record<string, unknown>; required: string[] } } };
    };
    const properties = Object.keys(schema.properties.annotations.items.properties);
    expect(properties.sort()).toEqual(
      ["aspect", "device", "end", "framework", "note", "start"].sort(),
    );
    for (const forbidden of ["text", "quote", "phrase", "span", "excerpt"]) {
      expect(properties).not.toContain(forbidden);
    }
  });

  it("requires a verdict and annotations in both modes", () => {
    for (const mode of ["decode", "draft"] as const) {
      const schema = diagnosticToolSchema(mode) as never as { required: string[] };
      expect(schema.required).toContain("verdict");
      expect(schema.required).toContain("annotations");
    }
  });
});
