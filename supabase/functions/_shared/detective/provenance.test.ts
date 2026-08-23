import { describe, expect, it } from "vitest";
import {
  independentOrigins,
  provenanceOf,
  readLineage,
  type LineageLink,
  type ProvenanceEvidence,
  type ProvenanceSource,
} from "./provenance.ts";

const SOURCES: ProvenanceSource[] = [
  { id: "s1", reference: 17, title: "Commission transcript", kind: "primary_document" },
  { id: "s2", reference: 21, title: "Evening broadcast", kind: "video" },
];

const CLAIM = { reference: 31, statement: "The van left before nine.", status: "claim" as const };

const labels = (path: ReturnType<typeof provenanceOf>[number]) => path.map((step) => step.label);

describe("the path from a claim to what says it", () => {
  // CLAIM-031 -> SOURCE-017 -> DOCUMENT -> PAGE 42, which is the path the
  // specification draws.
  it("draws the whole path when every part is there", () => {
    const evidence: ProvenanceEvidence[] = [
      { sourceId: "s1", classification: "supports", locator: "page 42" },
    ];
    expect(labels(provenanceOf(CLAIM, evidence, SOURCES)[0]!)).toEqual([
      "CLAIM 031", "SOURCE 017", "PRIMARY DOCUMENT", "page 42",
    ]);
  });

  it("draws one path per piece of evidence", () => {
    const evidence: ProvenanceEvidence[] = [
      { sourceId: "s1", classification: "supports", locator: "page 42" },
      { sourceId: "s2", classification: "contradicts", locator: "01:42:17" },
    ];
    const paths = provenanceOf(CLAIM, evidence, SOURCES);
    expect(paths).toHaveLength(2);
    expect(labels(paths[1]!)).toEqual(["CLAIM 031", "SOURCE 021", "VIDEO", "01:42:17"]);
  });

  // "Never create an orphaned AI statement with no source relationship."
  it("says plainly when nothing on file says it", () => {
    const path = provenanceOf(CLAIM, [], SOURCES)[0]!;
    expect(labels(path)).toEqual(["CLAIM 031", "nothing on file says this"]);
    expect(path[1]!.absent).toBe(true);
  });

  // A path ending at the source says "it is in there somewhere", and somewhere
  // in a 200-page transcript is not provenance.
  it("names a missing locator rather than stopping short", () => {
    const evidence: ProvenanceEvidence[] = [{ sourceId: "s1", classification: "supports" }];
    const path = provenanceOf(CLAIM, evidence, SOURCES)[0]!;
    expect(labels(path).at(-1)).toBe("no page, timestamp or paragraph recorded");
    expect(path.at(-1)!.absent).toBe(true);
  });

  it("names a source that has gone rather than rendering a gap", () => {
    const evidence: ProvenanceEvidence[] = [{ sourceId: "gone", classification: "supports" }];
    expect(labels(provenanceOf(CLAIM, evidence, SOURCES)[0]!).at(-1))
      .toBe("a source that is no longer in the case");
  });

  it("falls back to the statement when a claim has no number yet", () => {
    const evidence: ProvenanceEvidence[] = [{ sourceId: "s1", classification: "supports", locator: "p 1" }];
    const path = provenanceOf({ ...CLAIM, reference: null }, evidence, SOURCES)[0]!;
    expect(path[0]!.label).toBe("The van left before nine.");
  });
});

// "The same story appearing on 50 websites must not automatically count as 50
// independent sources."
describe("lineage", () => {
  const titleOf = (id: string) => ({ w: "The wire report", a: "The Herald", b: "The Post" })[id] ?? id;

  it("traces a chain back to one original", () => {
    const links: LineageLink[] = [
      { sourceId: "a", derivesFromId: "w", kind: "syndication" },
      { sourceId: "b", derivesFromId: "a", kind: "republication" },
    ];
    const reading = readLineage(["w", "a", "b"], links, titleOf);
    expect(reading.independentOrigins).toBe(1);
    expect(reading.says).toMatch(/all of which trace back to one original report: The wire report/);
    expect(reading.says).toMatch(/It is one source, not 3/);
  });

  it("counts several originals when there are several", () => {
    const links: LineageLink[] = [{ sourceId: "a", derivesFromId: "w", kind: "syndication" }];
    const reading = readLineage(["w", "a", "b"], links, titleOf);
    expect(reading.independentOrigins).toBe(2);
    expect(reading.says).toMatch(/trace back to 2 original reports/);
    expect(reading.says).toMatch(/Most of the apparent corroboration is republication/);
  });

  // No declared lineage is not the same as no lineage, and saying "these are
  // independent" would be a claim nobody made.
  it("says nothing when nothing derives from anything", () => {
    const reading = readLineage(["w", "a", "b"], [], titleOf);
    expect(reading.independentOrigins).toBe(3);
    expect(reading.says).toBeNull();
  });

  it("says nothing about an empty set", () => {
    expect(readLineage([], [], titleOf).says).toBeNull();
  });

  // A mistaken pair of declarations produces one, and the alternative is a hang.
  it("stops at a cycle rather than looping", () => {
    const links: LineageLink[] = [
      { sourceId: "a", derivesFromId: "b", kind: "syndication" },
      { sourceId: "b", derivesFromId: "a", kind: "syndication" },
    ];
    expect(readLineage(["a", "b"], links, titleOf).independentOrigins).toBeGreaterThan(0);
  });

  it("counts origins for a claim's sources directly", () => {
    const links: LineageLink[] = [
      { sourceId: "a", derivesFromId: "w", kind: "syndication" },
      { sourceId: "b", derivesFromId: "w", kind: "syndication" },
    ];
    expect(independentOrigins(["a", "b"], links)).toBe(1);
    expect(independentOrigins(["a", "b", "other"], links)).toBe(2);
  });

  // The case the specification actually describes: rewritten enough that no
  // two share a content hash, so byte-identity catches none of it.
  it("catches what identical bytes cannot", () => {
    const rewritten: LineageLink[] = [
      { sourceId: "a", derivesFromId: "w", kind: "syndication" },
      { sourceId: "b", derivesFromId: "w", kind: "translation" },
    ];
    expect(independentOrigins(["w", "a", "b"], rewritten)).toBe(1);
  });
});
