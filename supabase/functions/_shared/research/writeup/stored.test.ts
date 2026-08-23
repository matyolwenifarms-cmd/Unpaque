import { describe, expect, it } from "vitest";
import { parseAll, parseFinding, parseReference } from "./stored.ts";
import type { Finding } from "../analytics/result.ts";

const WHOLE: Finding = {
  test: "Welch's t-test",
  statistic: { symbol: "t", value: 2.11 },
  degreesOfFreedom: 37.4,
  p: 0.041,
  n: 40,
  effect: { kind: "hedges_g", value: 0.66, magnitude: "medium" },
  interval: { estimate: 3.2, lower: 0.14, upper: 6.26, level: 0.95 },
  comparisons: 1,
  assumptions: [{ name: "Normality", status: "met", detail: "K² = 1.2, p = .549" }],
};

const without = (key: keyof Finding) => {
  const copy: Record<string, unknown> = { ...WHOLE };
  delete copy[key];
  return copy;
};

describe("reading a finding back out of jsonb", () => {
  it("accepts one that is whole, and returns it unchanged", () => {
    expect(parseFinding(JSON.parse(JSON.stringify(WHOLE)))).toEqual(WHOLE);
  });

  it("accepts an ANOVA's two degrees of freedom", () => {
    const anova = { ...WHOLE, degreesOfFreedom: { between: 2, within: 27 } };
    expect(parseFinding(anova)?.degreesOfFreedom).toEqual({ between: 2, within: 27 });
  });

  // The rule `result.ts` exists to enforce, and the one a cast would undo. An
  // object with a p and no effect is not a Finding with a gap in it.
  it("refuses a p-value with no effect size beside it", () => {
    expect(parseFinding(without("effect"))).toBeNull();
  });

  it("refuses one with no interval, no n, or no comparison count", () => {
    expect(parseFinding(without("interval"))).toBeNull();
    expect(parseFinding(without("n"))).toBeNull();
    expect(parseFinding(without("comparisons"))).toBeNull();
  });

  // Never empty, by assumptions.ts. A results section that silently checked
  // nothing is the failure that rule was added to prevent.
  it("refuses one whose assumptions were checked away to nothing", () => {
    expect(parseFinding({ ...WHOLE, assumptions: [] })).toBeNull();
    expect(parseFinding({ ...WHOLE, assumptions: [{ name: "x", status: "maybe", detail: "" }] }))
      .toBeNull();
  });

  it("refuses an effect size of a kind the module does not produce", () => {
    expect(parseFinding({ ...WHOLE, effect: { kind: "vibes", value: 1, magnitude: null } }))
      .toBeNull();
  });

  it("refuses a p outside its range, and NaN anywhere", () => {
    expect(parseFinding({ ...WHOLE, p: 1.4 })).toBeNull();
    expect(parseFinding({ ...WHOLE, p: -0.1 })).toBeNull();
    // JSON has no NaN, so this is what a hand-edited row looks like.
    expect(parseFinding({ ...WHOLE, n: null })).toBeNull();
  });

  it("keeps a null magnitude, which is a legitimate answer and not a gap", () => {
    const noLabel = { ...WHOLE, effect: { kind: "pearson_r", value: 0.31, magnitude: null } };
    expect(parseFinding(noLabel)?.effect.magnitude).toBeNull();
  });

  it("refuses anything that is not an object at all", () => {
    for (const value of [null, undefined, 3, "a finding", [WHOLE]]) {
      expect(parseFinding(value)).toBeNull();
    }
  });
});

describe("reading a reference back", () => {
  const REF = {
    id: "r1", source: "openalex", title: "Waiting and trust",
    authors: [{ name: "Jane Smith" }], year: 2021,
    preprint: false, retraction: "none", openAccess: true,
    verification: "verified", availability: "metadata_only",
  };

  it("accepts a whole record", () => {
    expect(parseReference(REF)?.title).toBe("Waiting and trust");
  });

  // Absent is legitimate throughout a reference — a record with no year is
  // written "(n.d.)" rather than rejected.
  it("accepts one with no year and no venue", () => {
    const sparse = { ...REF, year: undefined, venue: undefined };
    expect(parseReference(sparse)).not.toBeNull();
  });

  // The one thing this feature promises never to show.
  it("refuses a reference with no provenance", () => {
    expect(parseReference({ ...REF, source: "" })).toBeNull();
    expect(parseReference({ ...REF, source: undefined })).toBeNull();
  });

  it("refuses one with no title, or an unknown retraction state", () => {
    expect(parseReference({ ...REF, title: "  " })).toBeNull();
    expect(parseReference({ ...REF, retraction: "probably" })).toBeNull();
  });

  it("refuses a malformed author rather than dropping the name", () => {
    expect(parseReference({ ...REF, authors: [{ id: "a1" }] })).toBeNull();
  });
});

describe("reading a list", () => {
  // Dropped and counted, never coerced. The same rule the reference pipeline
  // follows for an identifier that will not resolve.
  it("keeps what parses and says how much did not", () => {
    const parsed = parseAll([WHOLE, { test: "broken" }, WHOLE, null], parseFinding);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.dropped).toBe(2);
  });

  it("reports nothing dropped when everything is whole", () => {
    expect(parseAll([WHOLE, WHOLE], parseFinding).dropped).toBe(0);
  });
});
