import { describe, expect, it } from "vitest";
import type { Fetcher, ProviderOutcome, SearchProvider } from "./providers/types.ts";
import { fromProvider, type Reference } from "./reference.ts";
import { searchLiterature } from "./search.ts";
import type { Resolver } from "./verify.ts";

const fetcher: Fetcher = async () => ({ ok: true, status: 200, json: async () => ({}) });

function ref(source: string, doi: string, year: number, cited = 0): Reference {
  return fromProvider({ source, title: `Work ${doi}`, doi, year, citedByCount: cited })!;
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
