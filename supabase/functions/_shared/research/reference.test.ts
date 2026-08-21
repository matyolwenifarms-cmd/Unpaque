import { describe, expect, it } from "vitest";
import {
  byRecencyThenInfluence,
  fromProvider,
  normaliseDoi,
  shortProviderId,
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
    expect(fromProvider({ ...base, openAccess: true, fullTextUrl: "https://x/1.pdf" })?.status)
      .toBe("full_text");
  });

  it("marks one without as metadata_only — the state where no passage may show", () => {
    expect(fromProvider({ ...base, openAccess: false })?.status).toBe("metadata_only");
  });

  // Retraction outranks open access. A reader told "full text available" before
  // "retracted" has been told the wrong thing first.
  it("marks a retracted work as retracted even when its full text is open", () => {
    const reference = fromProvider({
      ...base, retracted: true, openAccess: true, fullTextUrl: "https://x/1.pdf",
    });
    expect(reference?.status).toBe("retracted");
    expect(reference?.retracted).toBe(true);
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
