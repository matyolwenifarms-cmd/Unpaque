import { describe, expect, it } from "vitest";
import {
  assembleDossier,
  discrepanciesByMoment,
  findDuplicateSources,
  findUnknowns,
  readClaim,
  type DossierClaim,
  type DossierEvent,
  type DossierInput,
} from "./dossier.ts";

const source = (id: string, title: string, hash?: string | null) => ({
  id, title, kind: "reporting", retrievedFrom: `https://example.org/${id}`,
  ...(hash === undefined ? {} : { contentHash: hash }),
});

const evidence = (
  sourceId: string,
  classification: "supports" | "contradicts" | "contextualises" | "undermines_source" | "inconclusive",
  hash?: string | null,
) => ({ sourceId, classification, sourceTitle: sourceId, ...(hash === undefined ? {} : { contentHash: hash }) });

const claim = (id: string, statement: string, over: Partial<DossierClaim> = {}): DossierClaim => ({
  id, statement, status: "claim", assertedBy: "a witness", evidence: [], ...over,
});

const event = (id: string, at: string | null, over: Partial<DossierEvent> = {}): DossierEvent => ({
  id, label: `event ${id}`, at, certainty: "claimed", origin: "account", sourceId: "s1", ...over,
});

describe("reading a claim's evidence", () => {
  // The distinction the whole feature turns on: what the evidence permits,
  // never what is true.
  it("says two independent sources support it, not that it is true", () => {
    const reading = readClaim(claim("c1", "A shot was fired at 21:15.", {
      evidence: [evidence("s1", "supports", "aaa"), evidence("s2", "supports", "bbb")],
    }));
    expect(reading.corroboratable).toBe(true);
    expect(reading.reading).toMatch(/2 independent sources support this and none contradicts it/);
    expect(reading.reading).not.toMatch(/\b(is true|happened|proves|confirms)\b/i);
  });

  // The single most common overstatement in an investigative file.
  it("names a single-source claim as exactly that", () => {
    const reading = readClaim(claim("c1", "x", { evidence: [evidence("s1", "supports", "aaa")] }));
    expect(reading.corroboratable).toBe(false);
    expect(reading.reading).toMatch(/One source supports this\. Nothing independent has confirmed it/);
    expect(reading.wouldSettleIt).toMatch(/second source that did not get it from the first/);
  });

  // A wire story in four papers is one source.
  it("does not count the same bytes twice", () => {
    const reading = readClaim(claim("c1", "x", {
      evidence: [evidence("s1", "supports", "same"), evidence("s2", "supports", "same")],
    }));
    expect(reading.supporting).toBe(1);
    expect(reading.corroboratable).toBe(false);
  });

  it("refuses to call anything corroborated while something contradicts it", () => {
    const reading = readClaim(claim("c1", "x", {
      evidence: [
        evidence("s1", "supports", "a"), evidence("s2", "supports", "b"),
        evidence("s3", "contradicts", "c"),
      ],
    }));
    expect(reading.corroboratable).toBe(false);
    expect(reading.reading).toMatch(/does not settle which is right/);
  });

  it("says plainly when nothing bears on a claim", () => {
    const reading = readClaim(claim("c1", "x"));
    expect(reading.reading).toMatch(/Nothing in the case file bears on this yet/);
  });

  // Every reading carries a way forward. A finding with no next step is a
  // dead end dressed as a conclusion.
  it("always says what would move it", () => {
    for (const item of [
      claim("a", "x"),
      claim("b", "x", { evidence: [evidence("s1", "supports", "a")] }),
      claim("c", "x", { evidence: [evidence("s1", "contradicts", "a")] }),
      claim("d", "x", { evidence: [evidence("s1", "contextualises", "a")] }),
    ]) {
      expect(readClaim(item).wouldSettleIt.trim()).not.toBe("");
    }
  });
});

describe("what remains unknown", () => {
  const base: DossierInput = {
    title: "A case", question: "Who fired?", claims: [], sources: [source("s1", "Report")],
    events: [],
  };

  // A case with no stated unknowns is not a complete case; it is one whose
  // gaps have not been written down.
  it("is never empty", () => {
    const unknowns = findUnknowns({ ...base, question: null }, []);
    expect(unknowns.length).toBeGreaterThan(0);
    expect(unknowns.join(" ")).toMatch(/statement about the checks, not about the investigation/);
  });

  it("says when the case's own question is unanswered", () => {
    const claims = [claim("c1", "Something", { evidence: [evidence("s1", "supports", "a")] })];
    const unknowns = findUnknowns({ ...base, claims }, claims.map(readClaim));
    expect(unknowns.join(" ")).toMatch(/"Who fired\?" — is not answered/);
  });

  it("names the claims resting on one source", () => {
    const claims = [claim("c1", "Only one source says this", {
      evidence: [evidence("s1", "supports", "a")],
    })];
    expect(findUnknowns({ ...base, claims }, claims.map(readClaim)).join(" "))
      .toMatch(/rests on a single source: "Only one source says this"/);
  });

  it("names the claims with no evidence at all", () => {
    const claims = [claim("c1", "Nothing supports this")];
    expect(findUnknowns({ ...base, claims }, claims.map(readClaim)).join(" "))
      .toMatch(/no evidence attached at all/);
  });

  it("notices a claim with nobody attached to it", () => {
    const claims = [claim("c1", "x", { assertedBy: null })];
    expect(findUnknowns({ ...base, claims }, claims.map(readClaim)).join(" "))
      .toMatch(/does not record who asserts it/);
  });

  it("notices an event with no time", () => {
    expect(findUnknowns({ ...base, events: [event("e1", null)] }, []).join(" "))
      .toMatch(/no time recorded and sits outside the sequence/);
  });

  // Silence about an unlabelled event reads as agreement, and is not.
  it("notices an event assigned to no moment", () => {
    const events = [event("e1", "2026-08-21T18:30:00Z")];
    expect(findUnknowns({ ...base, events }, []).join(" "))
      .toMatch(/not assigned to a moment.*undetected rather than absent/);
  });

  it("notices a case with no sources", () => {
    expect(findUnknowns({ ...base, sources: [] }, []).join(" "))
      .toMatch(/no sources in this file/);
  });
});

describe("discrepancies", () => {
  // findTemporalDiscrepancies deliberately does not guess which events ought
  // to coincide. The moment label is where the investigator says so, and this
  // is the difference between finding conflicts and manufacturing them.
  it("compares only records the investigator assigned to one moment", () => {
    const found = discrepanciesByMoment([
      event("e1", "2026-08-21T18:30:00Z", { moment: "the shooting", sourceId: "s1" }),
      event("e2", "2026-08-21T19:45:00Z", { moment: "the shooting", sourceId: "s2" }),
      event("e3", "2026-08-21T23:00:00Z", { moment: "the arrest", sourceId: "s3" }),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]!.differenceMinutes).toBe(75);
    expect(found[0]!.status).toBe("potential");
  });

  it("compares nothing that was never claimed to be simultaneous", () => {
    expect(discrepanciesByMoment([
      event("e1", "2026-08-21T18:30:00Z", { sourceId: "s1" }),
      event("e2", "2026-08-21T23:00:00Z", { sourceId: "s2" }),
    ])).toEqual([]);
  });

  // §9: the possible explanations are offered, and inaccuracy is among them
  // rather than first.
  it("offers explanations, with inaccuracy present and not leading", () => {
    const [found] = discrepanciesByMoment([
      event("e1", "2026-08-21T18:30:00Z", { moment: "m", sourceId: "s1" }),
      event("e2", "2026-08-21T20:30:00Z", { moment: "m", sourceId: "s2" }),
    ]);
    const summaries = found!.explanations.map((explanation) => explanation.summary);
    expect(summaries.length).toBeGreaterThan(1);
    expect(summaries.some((s) => /inaccurate/i.test(s))).toBe(true);
    expect(summaries[0]).not.toMatch(/inaccurate/i);
    for (const explanation of found!.explanations) {
      expect(explanation.distinguishedBy.trim()).not.toBe("");
    }
  });
});

describe("duplicate sources", () => {
  it("names sources that are the same bytes", () => {
    const found = findDuplicateSources([
      source("s1", "Herald report", "abc"),
      source("s2", "Gazette report", "abc"),
      source("s3", "Court record", "xyz"),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]!.titles.sort()).toEqual(["Gazette report", "Herald report"]);
  });

  // Unknown is not the same as identical.
  it("does not pair sources that simply have no hash", () => {
    expect(findDuplicateSources([source("s1", "A", null), source("s2", "B", null)])).toEqual([]);
  });
});

describe("assembling the whole thing", () => {
  const input: DossierInput = {
    title: "Zolani Tete shooting",
    question: "Who fired the shot?",
    sources: [source("s1", "Herald", "a"), source("s2", "Witness", "b"), source("s3", "Wire", "a")],
    claims: [
      claim("c1", "A shot was fired outside the venue.", {
        evidence: [evidence("s1", "supports", "a"), evidence("s2", "supports", "b")],
      }),
      claim("c2", "The vehicle was blue.", { evidence: [evidence("s2", "supports", "b")] }),
      claim("c3", "Nobody has looked at this.", { assertedBy: null }),
    ],
    events: [
      event("e1", "2026-08-21T18:30:00Z", { moment: "the shot", sourceId: "s1" }),
      event("e2", "2026-08-21T19:50:00Z", { moment: "the shot", sourceId: "s2" }),
      event("e3", null, { sourceId: "s2" }),
    ],
  };

  it("separates what the evidence carries from what it does not", () => {
    const dossier = assembleDossier(input);
    expect(dossier.established.map((r) => r.claim.id)).toEqual(["c1"]);
    expect(dossier.unsupported.map((r) => r.claim.id).sort()).toEqual(["c2", "c3"]);
  });

  it("orders the timeline and keeps the untimed event out of it", () => {
    const dossier = assembleDossier(input);
    expect(dossier.events.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(dossier.unplaced.map((e) => e.id)).toEqual(["e3"]);
  });

  it("finds the temporal conflict and the duplicated source", () => {
    const dossier = assembleDossier(input);
    expect(dossier.discrepancies).toHaveLength(1);
    expect(dossier.duplicateSources[0]!.titles.sort()).toEqual(["Herald", "Wire"]);
  });

  // Promoting a claim because a count crossed two is the collapse into truth
  // the epistemic model exists to prevent. §4 keeps that with a person.
  it("changes no claim's status", () => {
    const before = input.claims.map((c) => c.status);
    const dossier = assembleDossier(input);
    expect(input.claims.map((c) => c.status)).toEqual(before);
    expect(dossier.established[0]!.claim.status).toBe("claim");
  });

  it("reports how well the timeline is known overall", () => {
    expect(assembleDossier(input).timelineCertainty).toBeDefined();
  });
});

// Two defects visible only once a whole dossier was generated and read. Both
// read as carelessness in a document whose entire claim is care about what the
// record says.
describe("what a generated dossier got wrong before anyone read one", () => {
  it("agrees the verb with the count", () => {
    const one = readClaim(claim("c1", "x", {
      evidence: [evidence("s1", "supports", "a"), evidence("s2", "contradicts", "b")],
    }));
    expect(one.reading).toMatch(/1 independent source supports this/);
    expect(one.reading).toMatch(/1 piece of evidence contradicts it/);

    const many = readClaim(claim("c2", "x", {
      evidence: [
        evidence("s1", "supports", "a"), evidence("s2", "supports", "b"),
        evidence("s3", "contradicts", "c"), evidence("s4", "contradicts", "d"),
      ],
    }));
    expect(many.reading).toMatch(/2 independent sources support this/);
    expect(many.reading).toMatch(/2 pieces of evidence contradict it/);
  });

  // `"The vehicle was blue.".` — two full stops and a stray quote, on every
  // single-source claim.
  it("does not double the full stop when quoting a statement", () => {
    const claims = [claim("c1", "The vehicle involved was blue.", {
      evidence: [evidence("s1", "supports", "a")],
    })];
    const unknowns = findUnknowns(
      { title: "t", claims, sources: [source("s1", "S")], events: [] },
      claims.map(readClaim),
    );
    const text = unknowns.join(" ");
    expect(text).toMatch(/"The vehicle involved was blue"\./);
    expect(text).not.toMatch(/\."\./);
  });
});

describe("plurals", () => {
  // "piece of evidence" → "piece of evidences". The head of the phrase is
  // *piece*; the "of" clause modifies it rather than replacing it.
  it("pluralises the head of an of-phrase, not its last word", () => {
    const two = readClaim(claim("c1", "x", {
      evidence: [evidence("s1", "contradicts", "a"), evidence("s2", "contradicts", "b")],
    }));
    expect(two.reading).toMatch(/2 pieces of evidence contradict this/);
    expect(two.reading).not.toMatch(/evidences/);
  });
});
