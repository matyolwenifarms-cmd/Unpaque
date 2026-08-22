import { describe, expect, it } from "vitest";
import type { Fetcher, ProviderOutcome, SearchProvider } from "./providers/types.ts";
import { fromProvider, type Reference } from "./reference.ts";
import { searchLiterature } from "./search.ts";
import type { Resolver } from "./verify.ts";

const fetcher: Fetcher = async () => ({ ok: true, status: 200, json: async () => ({}) });

function ref(source: string, doi: string, year: number, cited = 0, rank?: number): Reference {
  return fromProvider({ source, title: `Work ${doi}`, doi, year, citedByCount: cited, rank })!;
}

/** A provider's answer, in the order the provider gave it. */
function ranked(source: string, works: Array<[doi: string, year: number]>): Reference[] {
  return works.map(([doi, year], rank) => ref(source, doi, year, 0, rank));
}

function provider(name: string, outcome: ProviderOutcome): SearchProvider {
  return { name, search: async () => outcome };
}

const ok = (references: Reference[], total = references.length): ProviderOutcome =>
  ({ ok: true, references, total, dropped: [] });

const resolves: Resolver = async () => ({ state: "found", retracted: false, record: null });

describe("searching the literature", () => {
  it("combines results from both providers", async () => {
    const result = await searchLiterature({ text: "framing" }, {
      providers: [
        provider("openalex", ok([ref("openalex", "10.1000/a", 2024)])),
        provider("crossref", ok([ref("crossref", "10.1000/b", 2020)])),
      ],
      fetcher,
      resolve: resolves,
    });
    expect(result.references).toHaveLength(2);
  });

  it("collapses a work both providers returned, and says it did", async () => {
    const result = await searchLiterature({ text: "framing" }, {
      providers: [
        provider("openalex", ok([ref("openalex", "10.1000/same", 2024)])),
        provider("crossref", ok([ref("crossref", "10.1000/same", 2024)])),
      ],
      fetcher,
      resolve: resolves,
    });
    expect(result.references).toHaveLength(1);
    expect(result.references[0]?.sources.sort()).toEqual(["crossref", "openalex"]);
    expect(result.notes.join(" ")).toMatch(/found by more than one provider/);
  });

  it("orders newest first, breaking ties on citation count", async () => {
    const result = await searchLiterature({ text: "x" }, {
      providers: [provider("openalex", ok([
        ref("openalex", "10.1000/old", 2011, 900),
        ref("openalex", "10.1000/new-quiet", 2025, 2),
        ref("openalex", "10.1000/new-loud", 2025, 400),
      ]))],
      fetcher,
      resolve: resolves,
    });
    expect(result.references.map((r) => r.doi)).toEqual([
      "10.1000/new-loud", "10.1000/new-quiet", "10.1000/old",
    ]);
  });
});

describe("telling the researcher what actually happened", () => {
  // A search that quietly returned fewer results because a provider was down
  // is indistinguishable from a smaller literature, and they cannot tell.
  it("carries on when one provider fails, and names it", async () => {
    const result = await searchLiterature({ text: "x" }, {
      providers: [
        provider("openalex", ok([ref("openalex", "10.1000/a", 2024)])),
        provider("crossref", { ok: false, status: 503, message: "down" }),
      ],
      fetcher,
      resolve: resolves,
    });
    expect(result.references).toHaveLength(1);
    expect(result.notes.join(" ")).toMatch(/crossref could not be reached \(503\)/);
  });

  it("distinguishes 'nothing answered' from 'nothing found'", async () => {
    const result = await searchLiterature({ text: "x" }, {
      providers: [provider("openalex", { ok: false, status: 0, message: "offline" })],
      fetcher,
      resolve: resolves,
    });
    expect(result.references).toEqual([]);
    expect(result.notes.join(" ")).toMatch(/This is not an empty literature/);
  });

  it("reports records dropped for having no identifier", async () => {
    const result = await searchLiterature({ text: "x" }, {
      providers: [provider("openalex", {
        ok: true, references: [ref("openalex", "10.1000/a", 2024)], total: 5,
        dropped: [{ reason: "no_identifier", title: "Something" }],
      })],
      fetcher,
      resolve: resolves,
    });
    expect(result.notes.join(" ")).toMatch(/1 record\(s\) with no usable identifier/);
  });

  it("says plainly when verification did not happen", async () => {
    const result = await searchLiterature({ text: "x" }, {
      providers: [provider("openalex", ok([ref("openalex", "10.1000/a", 2024)]))],
      fetcher,
    });
    expect(result.notes.join(" ")).toMatch(/not re-checked against the registration agency/);
  });

  it("reports the verification tally", async () => {
    const result = await searchLiterature({ text: "x" }, {
      providers: [provider("openalex", ok([
        ref("openalex", "10.1000/a", 2024), ref("openalex", "10.1000/b", 2023),
      ]))],
      fetcher,
      resolve: resolves,
    });
    expect(result.notes.join(" ")).toMatch(/2 verified/);
  });

  it("drops an unresolvable reference and says so", async () => {
    const result = await searchLiterature({ text: "x" }, {
      providers: [provider("openalex", ok([ref("openalex", "10.1000/ghost", 2024)]))],
      fetcher,
      resolve: async () => ({ state: "not_found" }),
    });
    expect(result.references).toEqual([]);
    expect(result.notes.join(" ")).toMatch(/dropped — the identifier did not resolve/);
  });

  it("keeps unverifiable references and flags them rather than losing them", async () => {
    const result = await searchLiterature({ text: "x" }, {
      providers: [provider("openalex", ok([ref("openalex", "10.1000/a", 2024)]))],
      fetcher,
      resolve: async () => ({ state: "unreachable" }),
    });
    expect(result.references).toHaveLength(1);
    expect(result.notes.join(" ")).toMatch(/could not be checked/);
  });

  it("refuses an empty query without troubling anybody's API", async () => {
    let called = false;
    const result = await searchLiterature({ text: "   " }, {
      providers: [{ name: "openalex", search: async () => { called = true; return ok([]); } }],
      fetcher,
    });
    expect(called).toBe(false);
    expect(result.notes).toEqual(["No search terms were given."]);
  });
});

describe("what comes back first", () => {
  // The reported failure, reduced to its bones. A search for media framing
  // returned 2025 trial registrations about irrigation, because the merged list
  // was sorted by date and the newest rows anywhere in the result set won.
  //
  // Both providers had ranked the relevant work first. The pipeline threw that
  // away.
  it("keeps the provider's relevance order rather than sorting by date", async () => {
    const result = await searchLiterature({ text: "media framing of protest" }, {
      providers: [
        provider("openalex", ok(ranked("openalex", [
          ["10.1000/framing", 2016],
          ["10.1000/coverage", 2011],
          ["10.1000/irrigation", 2025],
        ]))),
      ],
      fetcher,
      resolve: resolves,
    });
    expect(result.references.map((reference) => reference.doi)).toEqual([
      "10.1000/framing",
      "10.1000/coverage",
      "10.1000/irrigation",
    ]);
  });

  it("still offers newest first, when that is asked for", async () => {
    const result = await searchLiterature({ text: "media framing", order: "recency" }, {
      providers: [
        provider("openalex", ok(ranked("openalex", [
          ["10.1000/framing", 2016],
          ["10.1000/irrigation", 2025],
        ]))),
      ],
      fetcher,
      resolve: resolves,
    });
    expect(result.references[0]?.doi).toBe("10.1000/irrigation");
  });

  // Sorted by date, a reference list looks exactly like one ranked by
  // relevance. Somebody who cannot tell which they are reading cannot tell a
  // thin field from a bad sort.
  it("says so when the order is not relevance", async () => {
    const byDate = await searchLiterature({ text: "media framing", order: "recency" }, {
      providers: [provider("openalex", ok(ranked("openalex", [["10.1000/a", 2020]])))],
      fetcher,
      resolve: resolves,
    });
    expect(byDate.notes.join(" ")).toMatch(/newest first/i);

    const byRelevance = await searchLiterature({ text: "media framing" }, {
      providers: [provider("openalex", ok(ranked("openalex", [["10.1000/a", 2020]])))],
      fetcher,
      resolve: resolves,
    });
    expect(byRelevance.notes.join(" ")).not.toMatch(/newest first/i);
  });

  it("prefers the work both providers found, at equal rank", async () => {
    const result = await searchLiterature({ text: "media framing" }, {
      providers: [
        provider("openalex", ok([
          ref("openalex", "10.1000/agreed", 2015, 0, 0),
          ref("openalex", "10.1000/alone", 2024, 0, 1),
        ])),
        provider("crossref", ok([ref("crossref", "10.1000/agreed", 2015, 0, 0)])),
      ],
      fetcher,
      resolve: resolves,
    });
    expect(result.references[0]?.doi).toBe("10.1000/agreed");
    expect(result.references[0]?.sources).toHaveLength(2);
  });

  // Absent is not zero. Treating it as zero would put a reference nothing
  // ranked above everything the providers actually rated.
  it("puts an unranked reference last, not first", async () => {
    const result = await searchLiterature({ text: "media framing" }, {
      providers: [
        provider("openalex", ok([ref("openalex", "10.1000/unranked", 2025)])),
        provider("crossref", ok([ref("crossref", "10.1000/ranked", 2001, 0, 0)])),
      ],
      fetcher,
      resolve: resolves,
    });
    expect(result.references.map((reference) => reference.doi)).toEqual([
      "10.1000/ranked",
      "10.1000/unranked",
    ]);
  });

  // A long paste is reduced before it is sent, and the researcher is told.
  it("searches for the terms in a pasted proposal, and names them", async () => {
    let asked = "";
    const spy: SearchProvider = {
      name: "openalex",
      search: async (query) => {
        asked = query.text;
        return ok(ranked("openalex", [["10.1000/a", 2020]]));
      },
    };
    const proposal =
      "This study examines media framing of student protest movements in South African news " +
      "coverage. The research aims to analyse how framing devices in press reporting shape " +
      "public understanding of protest and its legitimacy across three newspapers.";
    const result = await searchLiterature({ text: proposal }, {
      providers: [spy], fetcher, resolve: resolves,
    });
    expect(asked).not.toBe(proposal);
    expect(asked).toContain("framing");
    expect(asked).not.toMatch(/\bstudy\b/);
    expect(result.notes.join(" ")).toMatch(/Searched for the terms/i);
  });
});
