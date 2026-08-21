import { describe, expect, it } from "vitest";
import { mergeAll, mergeReference, type MergedReference } from "./merge.ts";
import { fromProvider, type ProviderRecord } from "./reference.ts";

function make(source: string, overrides: Partial<ProviderRecord> = {}): MergedReference {
  const reference = fromProvider({
    source, title: `Title from ${source}`, doi: "10.1000/abc", ...overrides,
  })!;
  return { ...reference, sources: [source] };
}

describe("merging two records of the same work", () => {
  it("keeps both provider names", () => {
    const merged = mergeReference(make("openalex"), make("crossref"));
    expect(merged.sources.sort()).toEqual(["crossref", "openalex"]);
  });

  it("prefers the registration agency's title", () => {
    const merged = mergeReference(make("openalex"), make("crossref"));
    expect(merged.title).toBe("Title from crossref");
  });

  it("falls back to the aggregator when the agency has no venue", () => {
    const merged = mergeReference(
      make("openalex", { venue: "Journal of Fixtures" }),
      make("crossref"),
    );
    expect(merged.venue).toBe("Journal of Fixtures");
  });

  // Crossref never reports open access, so one source having a full text is
  // not a conflict — it is one knowing something the other never claimed.
  it("takes the full text from whichever source has one", () => {
    const merged = mergeReference(
      make("openalex", { openAccess: true, fullText: { url: "https://x/1.pdf", version: "published" } }),
      make("crossref"),
    );
    expect(merged.availability).toBe("full_text");
    expect(merged.fullText?.url).toBe("https://x/1.pdf");
  });

  it("takes the longer author list, because neither source invents names", () => {
    const merged = mergeReference(
      make("openalex", { authors: [{ name: "A One" }, { name: "B Two" }, { name: "C Three" }] }),
      make("crossref", { authors: [{ name: "A One" }] }),
    );
    expect(merged.authors).toHaveLength(3);
  });

  // Both counts undercount and neither overcounts, so the larger is the better
  // lower bound rather than a disagreement to split.
  it("takes the larger citation count", () => {
    const merged = mergeReference(
      make("openalex", { citedByCount: 940 }),
      make("crossref", { citedByCount: 310 }),
    );
    expect(merged.citedByCount).toBe(940);
  });

  it("escalates a contested retraction to confirmed when the agency confirms it", () => {
    const merged = mergeReference(
      make("openalex", { retracted: true }),
      make("crossref", { retracted: true, retractionAuthority: true }),
    );
    expect(merged.retraction).toBe("confirmed");
  });

  // The laundering case. An aggregator's flag plus a silent agency must not
  // add up to a confirmation.
  it("does NOT launder an aggregator's flag into a confirmation", () => {
    const merged = mergeReference(make("openalex", { retracted: true }), make("crossref"));
    expect(merged.retraction).toBe("contested");
  });

  it("labels a preprint if either source does", () => {
    expect(mergeReference(make("openalex", { preprint: true }), make("crossref")).preprint).toBe(true);
  });

  // Merge order follows whatever order the network answered in. A result that
  // changed with timing would be a genuinely horrible bug to chase.
  it("gives the same answer whichever way round the arguments come", () => {
    const a = make("openalex", {
      openAccess: true, fullText: { url: "https://x/1.pdf" }, citedByCount: 940,
      authors: [{ name: "A One" }, { name: "B Two" }], retracted: true,
    });
    const b = make("crossref", { venue: "J", citedByCount: 310, retracted: true, retractionAuthority: true });
    expect(mergeReference(a, b)).toEqual(mergeReference(b, a));
  });
});

describe("collapsing several result sets", () => {
  it("matches on DOI and combines", () => {
    const merged = mergeAll([make("openalex")], [make("crossref")]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.sources.sort()).toEqual(["crossref", "openalex"]);
  });

  it("keeps distinct works apart", () => {
    const merged = mergeAll(
      [make("openalex")],
      [make("crossref", { doi: "10.1000/different" })],
    );
    expect(merged).toHaveLength(2);
  });

  // Title matching is the obvious next idea and is a trap: a conference paper
  // and its extended journal version share a title and are different works.
  it("does not merge same-titled works with different DOIs", () => {
    const merged = mergeAll(
      [make("openalex", { title: "Identical Title" })],
      [make("crossref", { title: "Identical Title", doi: "10.1000/other" })],
    );
    expect(merged).toHaveLength(2);
  });

  it("keeps records that have no DOI rather than dropping them", () => {
    const noDoi = fromProvider({ source: "openalex", title: "Grey literature", providerId: "W9" })!;
    const merged = mergeAll([noDoi], [make("crossref")]);
    expect(merged).toHaveLength(2);
  });
});

describe("determinism", () => {
  // Arrival order tells you which provider answered faster and nothing else.
  // A result that varied with network timing would be miserable to chase.
  it("lists sources in a stable order regardless of merge order", () => {
    expect(mergeReference(make("openalex"), make("crossref")).sources)
      .toEqual(mergeReference(make("crossref"), make("openalex")).sources);
  });

  it("breaks an author-list tie toward the registration agency", () => {
    const merged = mergeReference(
      make("openalex", { authors: [{ name: "Aggregated Name" }] }),
      make("crossref", { authors: [{ name: "Registered Name" }] }),
    );
    expect(merged.authors[0]?.name).toBe("Registered Name");
    expect(mergeReference(
      make("crossref", { authors: [{ name: "Registered Name" }] }),
      make("openalex", { authors: [{ name: "Aggregated Name" }] }),
    ).authors[0]?.name).toBe("Registered Name");
  });
});
