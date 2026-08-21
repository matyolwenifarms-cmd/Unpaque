import { describe, expect, it } from "vitest";
import type { FullTextVersion } from "../reference.ts";
import { normalise, type NormalisedText } from "./normalise.ts";
import {
  expandToSentence,
  MAX_PASSAGE_CHARS,
  passageIsVerbatim,
  passageToolSchema,
  selectPassage,
  type PassageContext,
} from "./passage.ts";

const SOURCE = `Framing theory holds that communicators select some aspects of a perceived
reality and make them more salient. The choice of what to foreground is not
neutral. In organisational communication this often appears as a decision
presented as an inevitability, with the deciding party absent from the clause
that reports it. Attribu-
tion theory offers a complementary account of where responsibility is placed.`;

function contextFor(
  doc: NormalisedText,
  overrides: Partial<PassageContext> = {},
  version: FullTextVersion = "published",
): PassageContext {
  return {
    knownReferenceIds: new Set(["doi:10.1000/abc"]),
    documents: new Map([["doi:10.1000/abc", doc]]),
    versions: new Map([["doi:10.1000/abc", version]]),
    caveats: new Map([["doi:10.1000/abc", null]]),
    ...overrides,
  };
}

const doc = normalise(SOURCE);
const spanOf = (needle: string) => {
  const start = doc.text.indexOf(needle);
  return { start, end: start + needle.length };
};

describe("selecting a passage", () => {
  it("returns the source text, not anything a caller supplied", () => {
    const { start, end } = spanOf("The choice of what to foreground is not neutral.");
    const outcome = selectPassage(
      { referenceId: "doi:10.1000/abc", start, end, why: "Speaks to salience." },
      contextFor(doc),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(doc.text).toContain(outcome.passage.text);
  });

  it("gives a source range that lands on the passage", () => {
    const { start, end } = spanOf("The choice of what to foreground is not neutral.");
    const outcome = selectPassage(
      { referenceId: "doi:10.1000/abc", start, end, why: "Relevant." },
      contextFor(doc),
    );
    if (!outcome.ok) return;
    expect(passageIsVerbatim(outcome.passage, doc)).toBe(true);
  });

  it("works across a de-hyphenated word, landing on the split original", () => {
    const { start, end } = spanOf("Attribution theory offers a complementary account");
    const outcome = selectPassage(
      { referenceId: "doi:10.1000/abc", start, end, why: "Attribution." },
      contextFor(doc),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.passage.text).toContain("Attribution theory");
    expect(SOURCE.slice(outcome.passage.sourceStart, outcome.passage.sourceEnd))
      .toContain("Attribu-\ntion");
  });

  it("carries the version and its caveat through to the passage", () => {
    const { start, end } = spanOf("The choice of what to foreground is not neutral.");
    const context = contextFor(doc, {
      caveats: new Map([["doi:10.1000/abc", "Accepted manuscript — pagination may differ"]]),
    }, "accepted");
    const outcome = selectPassage(
      { referenceId: "doi:10.1000/abc", start, end, why: "x" },
      context,
    );
    if (!outcome.ok) return;
    expect(outcome.passage.version).toBe("accepted");
    expect(outcome.passage.caveat).toMatch(/Accepted manuscript/);
  });
});

describe("what selecting a passage refuses", () => {
  const good = spanOf("The choice of what to foreground is not neutral.");

  // The refusal the whole feature exists for.
  it("refuses a reference that was never retrieved", () => {
    const outcome = selectPassage(
      { referenceId: "doi:10.9999/invented", ...good, why: "x" },
      contextFor(doc),
    );
    expect(outcome).toMatchObject({ ok: false, reason: "unknown_reference" });
  });

  it("refuses when there is no retrieved full text, rather than generating one", () => {
    const outcome = selectPassage(
      { referenceId: "doi:10.1000/abc", ...good, why: "x" },
      contextFor(doc, { documents: new Map() }),
    );
    expect(outcome).toMatchObject({ ok: false, reason: "no_full_text" });
  });

  it.each([
    [-5, 20], [0, 0], [20, 5], [0, 99999],
  ])("refuses the out-of-bounds span %i-%i", (start, end) => {
    const outcome = selectPassage(
      { referenceId: "doi:10.1000/abc", start, end, why: "x" },
      contextFor(doc),
    );
    expect(outcome).toMatchObject({ ok: false, reason: "out_of_bounds" });
  });

  it("refuses an empty rationale — a passage with no stated relevance is decoration", () => {
    const outcome = selectPassage(
      { referenceId: "doi:10.1000/abc", ...good, why: "   " },
      contextFor(doc),
    );
    expect(outcome).toMatchObject({ ok: false, reason: "empty_rationale" });
  });

  it("refuses a span long enough to be a reproduction rather than a quotation", () => {
    const long = normalise("word ".repeat(MAX_PASSAGE_CHARS));
    const context = contextFor(long);
    const outcome = selectPassage(
      { referenceId: "doi:10.1000/abc", start: 0, end: long.text.length, why: "x" },
      context,
    );
    expect(outcome).toMatchObject({ ok: false, reason: "too_long" });
  });
});

describe("widening a span to whole sentences", () => {
  const text = "First sentence here. Second sentence follows it. Third one ends.";

  it("widens a span clipped mid-clause out to its sentence", () => {
    const start = text.indexOf("sentence follows");
    const { start: from, end: to } = expandToSentence(text, start, start + 8);
    expect(text.slice(from, to)).toBe("Second sentence follows it.");
  });

  it("leaves a span that is already a whole sentence alone", () => {
    const start = text.indexOf("Second");
    const end = start + "Second sentence follows it.".length;
    expect(expandToSentence(text, start, end)).toEqual({ start, end });
  });

  it("only ever widens, never narrows", () => {
    for (let start = 0; start < text.length - 5; start += 7) {
      const end = Math.min(start + 12, text.length);
      const widened = expandToSentence(text, start, end);
      expect(widened.start).toBeLessThanOrEqual(start);
      expect(widened.end).toBeGreaterThanOrEqual(end);
    }
  });

  it("handles a span at the very start and the very end", () => {
    expect(expandToSentence(text, 0, 5).start).toBe(0);
    expect(expandToSentence(text, text.length - 5, text.length).end).toBe(text.length);
  });
});

describe("the guarantee, checked rather than argued", () => {
  it("confirms a selected passage is verbatim in the source", () => {
    const { start, end } = spanOf("In organisational communication");
    const outcome = selectPassage(
      { referenceId: "doi:10.1000/abc", start, end, why: "x" },
      contextFor(doc),
    );
    if (!outcome.ok) return;
    expect(passageIsVerbatim(outcome.passage, doc)).toBe(true);
  });

  // The negative control. If this passed, the check above would prove nothing.
  it("catches a passage whose text was tampered with after selection", () => {
    const { start, end } = spanOf("In organisational communication");
    const outcome = selectPassage(
      { referenceId: "doi:10.1000/abc", start, end, why: "x" },
      contextFor(doc),
    );
    if (!outcome.ok) return;
    const tampered = { ...outcome.passage, text: "a sentence the author never wrote" };
    expect(passageIsVerbatim(tampered, doc)).toBe(false);
  });
});

describe("the tool schema the model fills in", () => {
  const ids = ["doi:10.1000/abc", "openalex:W123"];

  it("pins reference_id to the ids actually retrieved", () => {
    const schema = JSON.parse(JSON.stringify(passageToolSchema(ids)));
    expect(schema.properties.passages.items.properties.reference_id.enum).toEqual(ids);
  });

  // The most important assertion in this file. If a text field ever appears
  // here, a model can write a quotation and the entire guarantee is gone —
  // silently, because everything else would keep working.
  it("offers no field a quotation could be written into", () => {
    const schema = JSON.parse(JSON.stringify(passageToolSchema(ids)));
    const properties = schema.properties.passages.items.properties;
    expect(Object.keys(properties).sort()).toEqual(["end", "reference_id", "start", "why"]);
    for (const forbidden of ["text", "quote", "quotation", "passage", "excerpt", "content"]) {
      expect(properties[forbidden]).toBeUndefined();
    }
  });

  it("uses no JSON Schema keyword strict mode would reject", () => {
    const unsupported = ["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "pattern"];
    const found: string[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (typeof node !== "object" || node === null) return;
      for (const [key, value] of Object.entries(node)) {
        if (unsupported.includes(key)) found.push(key);
        walk(value);
      }
    };
    walk(passageToolSchema(ids));
    expect(found).toEqual([]);
  });

  it("closes every object, as strict mode requires", () => {
    const schema = JSON.parse(JSON.stringify(passageToolSchema(ids)));
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.passages.items.additionalProperties).toBe(false);
  });
});
