import { describe, expect, it } from "vitest";
import {
  byRecencyThenInfluence,
  fromProvider,
  leadingCaveat,
  normaliseDoi,
  shortProviderId,
  type ProviderRecord,
  type Reference,
} from "./reference.ts";

describe("normalising a DOI", () => {
  it.each([
    ["https://doi.org/10.1111/j.1460-2466.1993.tb01304.x", "10.1111/j.1460-2466.1993.tb01304.x"],
    ["http://dx.doi.org/10.1000/ABC", "10.1000/abc"],
    ["doi:10.1000/abc", "10.1000/abc"],
    ["  10.1000/ABC  ", "10.1000/abc"],
  ])("reduces %s", (input, expected) => {
    expect(normaliseDoi(input)).toBe(expected);
  });

  // Negative controls. A malformed identifier passed through as though it were
  // a DOI becomes a link that 404s in a bibliography, which looks to a marker
  // exactly like a fabricated citation.
  it.each([[null], [undefined], [""], ["not-a-doi"], ["10.x/abc"], ["11.1000/abc"], [42]])(
    "refuses %p",
    (input) => {
      expect(normaliseDoi(input)).toBeUndefined();
    },
  );
});

describe("shortening a provider id", () => {
  it("takes the last segment", () => {
    expect(shortProviderId("https://openalex.org/W2741809807")).toBe("W2741809807");
  });
  it.each([[null], [""], ["   "]])("refuses %p", (input) => {
    expect(shortProviderId(input)).toBeUndefined();
  });
});

describe("constructing a reference", () => {
  const base = { source: "openalex", title: "A title", providerId: "https://openalex.org/W1" };

  it("builds one from a provider record", () => {
    const reference = fromProvider({ ...base, doi: "https://doi.org/10.1000/abc", year: 2024 });
    expect(reference?.id).toBe("doi:10.1000/abc");
    expect(reference?.source).toBe("openalex");
    expect(reference?.year).toBe(2024);
  });

  it("falls back to the provider id when there is no DOI", () => {
    expect(fromProvider(base)?.id).toBe("openalex:W1");
  });

  // The load-bearing refusals. A row with no identifier cannot be looked up,
  // and a row that cannot be looked up is not a citation.
  it("refuses a record with no identifier at all", () => {
    expect(fromProvider({ source: "openalex", title: "A title" })).toBeNull();
  });

  it("refuses a record with no title", () => {
    expect(fromProvider({ source: "openalex", providerId: "W1" })).toBeNull();
  });

  it("refuses a record whose only identifier is a malformed DOI", () => {
    expect(fromProvider({ source: "openalex", title: "T", doi: "nonsense" })).toBeNull();
  });

  it("drops authors with no name rather than inventing one", () => {
    const reference = fromProvider({
      ...base,
      authors: [{ name: "Real Person" }, { name: "" }, { id: "A2" }],
    });
    expect(reference?.authors).toEqual([{ name: "Real Person", id: undefined }]);
  });

  it("marks a reference with open full text as full_text", () => {
    expect(fromProvider({ ...base, openAccess: true, fullTextUrl: "https://x/1.pdf" })?.availability)
      .toBe("full_text");
  });

  it("marks one without as metadata_only — the state where no passage may show", () => {
    expect(fromProvider({ ...base, openAccess: false })?.availability).toBe("metadata_only");
  });

  it("starts everything at provider_only — a provider returning it is not a check", () => {
    expect(fromProvider(base)?.verification).toBe("provider_only");
  });

  // The two axes are independent, which is the whole reason they are separate
  // fields. A retracted paper with open full text has to be able to say both.
  it("records retraction and availability independently", () => {
    const reference = fromProvider({
      ...base, retracted: true, openAccess: true, fullTextUrl: "https://x/1.pdf",
    });
    expect(reference?.retraction).toBe("contested");
    expect(reference?.availability).toBe("full_text");
  });
});

describe("who is allowed to confirm a retraction", () => {
  const base = { source: "s", title: "A title", providerId: "W1" };

  it("treats an aggregator's flag as contested, not settled", () => {
    expect(fromProvider({ ...base, retracted: true })?.retraction).toBe("contested");
  });

  it("lets a registration agency confirm one", () => {
    expect(fromProvider({ ...base, retracted: true, retractionAuthority: true })?.retraction)
      .toBe("confirmed");
  });

  it("says none when nobody flagged it", () => {
    expect(fromProvider(base)?.retraction).toBe("none");
  });

  // Authority without a flag is not a claim about anything.
  it("does not confirm a retraction nobody reported", () => {
    expect(fromProvider({ ...base, retractionAuthority: true })?.retraction).toBe("none");
  });
});

describe("ordering", () => {
  const ref = (year: number, citedByCount: number): Reference =>
    fromProvider({ source: "s", title: "t", providerId: `W${year}${citedByCount}`, year, citedByCount })!;

  it("puts the newest first, as asked", () => {
    const sorted = [ref(2019, 1), ref(2026, 1), ref(2022, 1)].sort(byRecencyThenInfluence);
    expect(sorted.map((r) => r.year)).toEqual([2026, 2022, 2019]);
  });

  it("breaks ties on citation count, so the foundational paper is not buried", () => {
    const sorted = [ref(2024, 3), ref(2024, 900), ref(2024, 40)].sort(byRecencyThenInfluence);
    expect(sorted.map((r) => r.citedByCount)).toEqual([900, 40, 3]);
  });
});

describe("the caveat a reader is shown first", () => {
  const make = (overrides: Partial<ProviderRecord>) =>
    fromProvider({ source: "s", title: "t", providerId: "W1", ...overrides })!;

  it("leads with a confirmed retraction, even when the full text is open", () => {
    const reference = make({
      retracted: true, retractionAuthority: true, openAccess: true, fullTextUrl: "https://x/1.pdf",
    });
    expect(leadingCaveat(reference)).toBe("Retracted");
  });

  it("leads with retraction even when the identifier did not resolve", () => {
    const reference = {
      ...make({ retracted: true, retractionAuthority: true }),
      verification: "unresolvable" as const,
    };
    expect(leadingCaveat(reference)).toBe("Retracted");
  });

  // The wording matters as much as the state. It asks the researcher to look;
  // it does not assert a retraction the record does not support, and it does
  // not quietly drop a flag that might be right.
  it("phrases a contested retraction as something to check, not as a finding", () => {
    const caveat = leadingCaveat(make({ retracted: true }));
    expect(caveat).toBe("Possibly retracted — sources disagree, check before citing");
    expect(caveat).not.toBe("Retracted");
  });

  it("puts a contested retraction ahead of every lesser caveat", () => {
    const reference = { ...make({ retracted: true, preprint: true }), verification: "unresolvable" as const };
    expect(leadingCaveat(reference)).toMatch(/^Possibly retracted/);
  });

  it("warns about an unresolvable identifier before a missing full text", () => {
    const reference = { ...make({}), verification: "unresolvable" as const };
    expect(leadingCaveat(reference)).toBe("Identifier did not resolve");
  });

  it("labels a preprint", () => {
    expect(leadingCaveat(make({ preprint: true }))).toBe("Preprint — not peer reviewed");
  });

  it("says when there is no openly available full text", () => {
    expect(leadingCaveat(make({}))).toBe("Full text not openly available");
  });

  it("says nothing about a verified, peer-reviewed, openly readable paper", () => {
    const reference = {
      ...make({ openAccess: true, fullTextUrl: "https://x/1.pdf" }),
      verification: "verified" as const,
    };
    expect(leadingCaveat(reference)).toBeNull();
  });
});
