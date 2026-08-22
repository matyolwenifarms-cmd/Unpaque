import { describe, expect, it } from "vitest";
import {
  MAX_SPAN_FRACTION,
  annotationsAreFaithful,
  describeProblem,
  parseAnnotations,
  segments,
  type Annotation,
} from "./annotate.ts";

// The example from the running site, which is what this is built against.
const TEXT =
  "Following a review of current operating conditions, a decision has been made " +
  "to consolidate several roles. Regrettably, a number of positions will be impacted. " +
  "We remain deeply committed to our people, and affected colleagues will be contacted " +
  "in due course with further information.";

const at = (phrase: string) => {
  const start = TEXT.indexOf(phrase);
  if (start < 0) throw new Error(`fixture error: "${phrase}" is not in the text`);
  return { start, end: start + phrase.length };
};

const raw = (phrase: string, over: Record<string, unknown> = {}) => ({
  ...at(phrase),
  device: "agentless_framing",
  framework: "critical_discourse",
  aspect: "responsibility",
  note: "The passive construction reports the outcome without naming who chose it.",
  ...over,
});

describe("anchoring a finding to the text", () => {
  it("accepts the site's own five spans", () => {
    const result = parseAnnotations(
      [
        raw("a decision has been made"),
        raw("Regrettably", { device: "sentiment_softener", framework: "face", aspect: "framing" }),
        raw("a number of positions will be impacted", { device: "nominalisation" }),
        raw("deeply committed to our people", {
          device: "value_claim", framework: "image_repair", aspect: "framing",
        }),
        raw("in due course", {
          device: "strategic_vagueness", framework: "strategic_ambiguity", aspect: "ambiguity",
        }),
      ],
      TEXT,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.annotations).toHaveLength(5);
      expect(TEXT.slice(result.annotations[0]!.start, result.annotations[0]!.end))
        .toBe("a decision has been made");
    }
  });

  it("returns them in the text's order however they arrive", () => {
    const result = parseAnnotations(
      [raw("in due course", { device: "strategic_vagueness" }), raw("a decision has been made")],
      TEXT,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.annotations[0]!.start).toBeLessThan(result.annotations[1]!.start);
    }
  });
});

describe("what is refused", () => {
  it("an offset past the end of the text", () => {
    const result = parseAnnotations([{ ...raw("a decision has been made"), end: TEXT.length + 40 }], TEXT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]?.kind).toBe("out_of_bounds");
  });

  it("a non-integer offset", () => {
    const result = parseAnnotations([{ ...raw("Regrettably"), start: 4.5 }], TEXT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]?.kind).toBe("bad_offset");
  });

  it("a span of whitespace", () => {
    const space = TEXT.indexOf(" ");
    const result = parseAnnotations([{ ...raw("Regrettably"), start: space, end: space + 1 }], TEXT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(["blank", "too_short"]).toContain(result.problems[0]?.kind);
  });

  // The failure the offset design trades for. A model cannot invent a phrase,
  // but it can miscount — and a highlight that starts four characters early
  // reads as a typo rather than as a bug.
  it("a span that starts inside a word", () => {
    const { start, end } = at("a decision has been made");
    // +3, not +2. At +2 the span begins exactly at "decision" — a legitimate
    // boundary — and an earlier version of this test asserted a failure that
    // should not happen. +3 lands on the "e".
    const result = parseAnnotations([{ ...raw("Regrettably"), start: start + 3, end }], TEXT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems[0]?.kind).toBe("mid_word");
      expect(describeProblem(result.problems[0]!)).toContain("decision");
    }
  });

  it("a span that ends inside a word", () => {
    const { start, end } = at("a decision has been made");
    const result = parseAnnotations([{ ...raw("Regrettably"), start, end: end - 2 }], TEXT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]?.kind).toBe("mid_word");
  });

  // The counterpart, and the one that matters: a boundary that is legitimate
  // must not be refused. A mid-word check that fires on correct spans would
  // reject good analyses and be far harder to notice than one that never fires.
  it("accepts a span that begins exactly at a word", () => {
    const { start, end } = at("a decision has been made");
    const result = parseAnnotations([{ ...raw("Regrettably"), start: start + 2, end }], TEXT);
    expect(result.ok).toBe(true);
  });

  // Two highlights over the same characters cannot both be rendered, and
  // picking one silently would hide a finding.
  it("two annotations over the same characters", () => {
    const first = at("a decision has been made");
    const result = parseAnnotations(
      [
        { ...raw("Regrettably"), ...first },
        { ...raw("Regrettably"), start: first.start + 2, end: first.end + 4 },
      ],
      TEXT,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.some((p) => p.kind === "overlap")).toBe(true);
  });

  it("a highlight covering most of the message", () => {
    const result = parseAnnotations(
      [{ ...raw("Regrettably"), start: 0, end: Math.ceil(TEXT.length * MAX_SPAN_FRACTION) + 10 }],
      TEXT,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]?.kind).toBe("too_long");
  });

  it("a device, framework or aspect outside its enum", () => {
    for (const [field, value, kind] of [
      ["device", "vibes", "unknown_device"],
      ["framework", "astrology", "unknown_framework"],
      ["aspect", "mood", "unknown_aspect"],
    ] as const) {
      const result = parseAnnotations([raw("Regrettably", { [field]: value })], TEXT);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problems[0]?.kind).toBe(kind);
    }
  });

  it("an annotation with no prose", () => {
    const result = parseAnnotations([raw("Regrettably", { note: "   " })], TEXT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]?.kind).toBe("empty_note");
  });

  it("every problem describes itself in a sentence naming the index", () => {
    const result = parseAnnotations([raw("Regrettably", { device: "vibes" })], TEXT);
    if (!result.ok) {
      for (const problem of result.problems) {
        expect(describeProblem(problem)).toMatch(/^annotations\[\d+\]/);
      }
    }
  });
});

describe("laying the text out", () => {
  const annotations: Annotation[] = [
    { ...at("a decision has been made"), device: "agentless_framing", framework: "critical_discourse", aspect: "responsibility", note: "n" },
    { ...at("in due course"), device: "strategic_vagueness", framework: "strategic_ambiguity", aspect: "ambiguity", note: "n" },
  ];

  // The reader sees their own message with the findings inside it, so the
  // parts nobody flagged have to be there too — and exactly as submitted.
  it("reconstructs the input exactly", () => {
    expect(segments(TEXT, annotations).map((s) => s.text).join("")).toBe(TEXT);
  });

  it("marks the highlighted pieces and leaves the rest plain", () => {
    const marked = segments(TEXT, annotations).filter((s) => s.annotation);
    expect(marked.map((s) => s.text)).toEqual(["a decision has been made", "in due course"]);
    expect(segments(TEXT, annotations).some((s) => !s.annotation)).toBe(true);
  });

  it("handles a text with no annotations at all", () => {
    expect(segments(TEXT, [])).toEqual([{ text: TEXT }]);
  });

  it("handles an annotation flush against each end", () => {
    const whole: Annotation[] = [
      { start: 0, end: 9, device: "hedge", framework: "strategic_ambiguity", aspect: "ambiguity", note: "n" },
    ];
    expect(segments(TEXT, whole).map((s) => s.text).join("")).toBe(TEXT);
    expect(segments(TEXT, whole)[0]!.annotation).toBeDefined();
  });
});

describe("the guarantee, checked rather than argued", () => {
  it("holds for annotations that came through the parser", () => {
    const result = parseAnnotations([raw("a decision has been made")], TEXT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(annotationsAreFaithful(TEXT, result.annotations)).toBe(true);
  });

  // The negative control for the check itself. If it cannot fail it is not
  // evidence that anything held.
  it("fails for an annotation pointing outside the text", () => {
    const bad: Annotation[] = [
      { start: 5, end: TEXT.length + 100, device: "hedge", framework: "strategic_ambiguity", aspect: "ambiguity", note: "n" },
    ];
    expect(annotationsAreFaithful(TEXT, bad)).toBe(false);
  });
});
