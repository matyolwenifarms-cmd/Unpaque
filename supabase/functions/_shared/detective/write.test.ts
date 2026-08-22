import { describe, expect, it } from "vitest";
import { assembleDossier, type DossierInput } from "./dossier.ts";
import { PROVENANCE, writeDossier } from "./write.ts";

const AT = new Date("2026-08-22T17:40:00Z");

const input: DossierInput = {
  title: "A shooting",
  question: "Who fired?",
  sources: [
    { id: "s1", title: "Herald", kind: "reporting", retrievedFrom: "url", contentHash: "a" },
    { id: "s2", title: "Witness", kind: "testimony", retrievedFrom: "interview", contentHash: "b" },
    { id: "s3", title: "Gazette", kind: "reporting", retrievedFrom: "url", contentHash: "a" },
  ],
  claims: [
    { id: "c1", statement: "A shot was fired.", status: "claim", assertedBy: "two sources",
      evidence: [
        { sourceId: "s1", classification: "supports", contentHash: "a", sourceTitle: "Herald", excerpt: "gunfire" },
        { sourceId: "s2", classification: "supports", contentHash: "b", sourceTitle: "Witness" },
      ] },
    { id: "c2", statement: "The car was blue.", status: "claim", assertedBy: "a witness",
      evidence: [{ sourceId: "s2", classification: "supports", contentHash: "b", sourceTitle: "Witness" }] },
  ],
  events: [
    { id: "e1", label: "Shot fired", at: "2026-08-21T18:30:00Z", certainty: "claimed", origin: "account", sourceId: "s1", moment: "the shot" },
    { id: "e2", label: "Shot heard", at: "2026-08-21T19:50:00Z", certainty: "approximate", origin: "account", sourceId: "s2", moment: "the shot" },
    { id: "e3", label: "Car seen", at: null, certainty: "unknown", origin: "account", sourceId: "s2" },
  ],
};

const document = () => writeDossier(assembleDossier(input), AT);

describe("the dossier as a document", () => {
  // The order is §4's argument, not a layout preference. A document that
  // leads with findings and buries the gaps has told the reader what to think
  // before telling them what is missing.
  it("puts the unknowns before the findings can settle", () => {
    const text = document();
    const supports = text.indexOf("## What the evidence supports");
    const notYet = text.indexOf("## What the evidence does not yet carry");
    const unknown = text.indexOf("## What remains unknown");
    const notFit = text.indexOf("## What does not fit");
    expect(supports).toBeGreaterThan(0);
    expect(notYet).toBeGreaterThan(supports);
    expect(unknown).toBeGreaterThan(notYet);
    expect(notFit).toBeGreaterThan(unknown);
  });

  it("says what it is, at the top, before anything else", () => {
    const text = document();
    expect(text).toContain(PROVENANCE);
    expect(text.indexOf(PROVENANCE)).toBeLessThan(text.indexOf("## What the evidence supports"));
  });

  // "Who did it" is not a question this document answers, and the absence is
  // the product.
  it("concludes nothing", () => {
    const text = document();
    for (const forbidden of [
      /\bwe conclude\b/i, /\bit is clear that\b/i, /\bproves\b/i, /\bthe culprit\b/i,
      /\bresponsible for\b/i, /\bis guilty\b/i, /\btherefore .* did\b/i, /\bmust have\b/i,
    ]) {
      expect(text).not.toMatch(forbidden);
    }
  });

  it("names the difference and offers explanations rather than implying one", () => {
    const text = document();
    expect(text).toMatch(/describe the same moment 80 minutes apart/);
    expect(text).toMatch(/Possible explanations, none established:/);
    // Naming only the difference and leaving the reader to supply a reason is
    // how a document implies deceit without saying it.
    expect(text).toMatch(/\*Distinguished by:\*/);
  });

  it("says the two byte-identical reports are one source", () => {
    expect(document()).toMatch(/\*\*Herald\*\* and \*\*Gazette\*\* are byte-identical/);
  });

  it("carries every claim's next step", () => {
    const text = document();
    expect(text.match(/\*What would settle it:\*/g)?.length).toBe(input.claims.length);
  });

  it("shows the sequence and says what sits outside it", () => {
    const text = document();
    expect(text).toMatch(/\| When \| What \| How well known \| Established by \|/);
    expect(text).toMatch(/Outside the sequence, with no time recorded: Car seen\./);
  });

  // An empty section reads as an oversight. This has to read as the finding.
  it("says so when nothing is supported, rather than leaving a blank", () => {
    const bare = writeDossier(assembleDossier({ ...input, claims: [], events: [] }), AT);
    expect(bare).toMatch(/Nothing in this file is supported by two independent sources/);
    expect(bare).toMatch(/state of the record, not a rendering fault/);
  });

  it("always has something under what remains unknown", () => {
    const empty = writeDossier(
      assembleDossier({ title: "t", claims: [], sources: [], events: [] }),
      AT,
    );
    const section = empty.slice(empty.indexOf("## What remains unknown"), empty.indexOf("## What does not fit"));
    expect(section.trim().split("\n").filter((line) => line.startsWith("- ")).length).toBeGreaterThan(0);
  });

  it("dates itself and says the document is a reading of a file that can change", () => {
    expect(document()).toMatch(/Assembled 2026-08-22 17:40 UTC/);
    expect(document()).toMatch(/will produce a different document if the file has changed/);
  });
});
