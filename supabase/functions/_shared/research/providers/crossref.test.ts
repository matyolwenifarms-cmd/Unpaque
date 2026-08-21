import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { crossref } from "./crossref.ts";
import type { Fetcher } from "./types.ts";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../fixtures/crossref-synthetic.json", import.meta.url)), "utf8"),
);

function fetcherReturning(body: unknown, ok = true, status = 200): Fetcher {
  return async () => ({ ok, status, json: async () => body });
}

async function search() {
  const outcome = await crossref().search({ text: "framing" }, fetcherReturning(fixture));
  if (!outcome.ok) throw new Error("expected a successful search");
  return outcome;
}

describe("the Crossref adapter", () => {
  it("reads titles out of the array Crossref returns them in", async () => {
    const { references } = await search();
    expect(references[0]?.title).toBe("A journal article with two authors");
  });

  it("joins given and family names", async () => {
    const { references } = await search();
    expect(references[0]?.authors.map((a) => a.name)).toEqual(["Ada Researcher", "Bo Colleague"]);
  });

  it("keeps a corporate author that has a name and no given or family", async () => {
    const { references } = await search();
    const notice = references.find((r) => r.doi === "10.1000/fixture.retraction-notice");
    expect(notice?.authors.map((a) => a.name)).toEqual(["The Editors"]);
  });

  it("digs the year out of the nested date-parts tuple", async () => {
    const { references } = await search();
    expect(references[0]?.year).toBe(2023);
  });

  it("falls back to another date field when issued is [[null]]", async () => {
    const { references } = await search();
    const undated = references.find((r) => r.doi === "10.1000/fixture.undated");
    expect(undated?.year).toBe(2015);
  });

  it("reads container-title as the venue", async () => {
    const { references } = await search();
    expect(references[0]?.venue).toBe("Journal of Fixtures");
  });

  it("survives an empty container-title array without inventing a venue", async () => {
    const { references } = await search();
    const preprint = references.find((r) => r.doi === "10.1000/fixture.posted");
    expect(preprint?.venue).toBeUndefined();
  });

  it("treats posted-content as a preprint", async () => {
    const { references } = await search();
    expect(references.find((r) => r.doi === "10.1000/fixture.posted")?.preprint).toBe(true);
  });

  // The direction of the relationship is the whole thing here. Read the wrong
  // way round, every retraction notice is marked retracted and every actually
  // retracted paper sails through clean — which is the exact opposite of what
  // the check is for.
  it("marks a work carrying updated-by as retracted", async () => {
    const { references } = await search();
    // Confirmed, not contested: Crossref registers retractions, so its word is
    // the record rather than a report of it.
    expect(references.find((r) => r.doi === "10.1000/fixture.retracted-work")?.retraction)
      .toBe("confirmed");
  });

  it("does NOT mark the retraction notice itself as retracted", async () => {
    const { references } = await search();
    expect(references.find((r) => r.doi === "10.1000/fixture.retraction-notice")?.retraction)
      .toBe("none");
  });

  it("never claims open access, because Crossref does not report it", async () => {
    const { references } = await search();
    for (const reference of references) {
      expect(reference.availability).toBe("metadata_only");
      expect(reference.fullTextUrl).toBeUndefined();
    }
  });

  it("counts the record with no DOI rather than dropping it silently", async () => {
    const outcome = await search();
    expect(outcome.dropped).toEqual([
      { reason: "no_identifier", title: "A record with no DOI at all" },
    ]);
  });

  it("reports a bad status rather than throwing", async () => {
    const outcome = await crossref().search({ text: "x" }, fetcherReturning({}, false, 503));
    expect(outcome).toEqual({ ok: false, status: 503, message: "crossref returned 503" });
  });
});

describe("resolving a single DOI", () => {
  const single = { status: "ok", message: fixture.message.items[1] };

  it("finds one, and reports its retraction", async () => {
    const outcome = await crossref().resolve("10.1000/fixture.retracted-work", fetcherReturning(single));
    expect(outcome.state).toBe("found");
    if (outcome.state !== "found") return;
    expect(outcome.retracted).toBe(true);
  });

  it("reports a 404 as not_found", async () => {
    const outcome = await crossref().resolve("10.1000/nope", fetcherReturning({}, false, 404));
    expect(outcome).toEqual({ state: "not_found" });
  });

  it("refuses a malformed DOI without spending a request", async () => {
    let called = false;
    const outcome = await crossref().resolve("not-a-doi", async () => {
      called = true;
      return { ok: true, status: 200, json: async () => single };
    });
    expect(outcome).toEqual({ state: "malformed" });
    expect(called).toBe(false);
  });

  // Unreachable and absent must never be conflated. One means "we could not
  // check"; the other means "this does not exist".
  it("reports a thrown request as unreachable, not as not_found", async () => {
    const outcome = await crossref().resolve("10.1000/x", async () => {
      throw new Error("ECONNRESET");
    });
    expect(outcome).toEqual({ state: "unreachable" });
  });

  it("reports a 500 as unreachable, not as not_found", async () => {
    const outcome = await crossref().resolve("10.1000/x", fetcherReturning({}, false, 500));
    expect(outcome).toEqual({ state: "unreachable" });
  });
});

// ---------------------------------------------------------------------------
// The same adapter against what Crossref actually returned. `npm run
// research:record` writes this; until then these skip, visibly.
// ---------------------------------------------------------------------------

function loadRecorded(): unknown | null {
  try {
    return JSON.parse(
      readFileSync(fileURLToPath(new URL("../fixtures/crossref-recorded.json", import.meta.url)), "utf8"),
    );
  } catch {
    return null;
  }
}

const recorded = loadRecorded();

describe.skipIf(recorded === null)("the Crossref adapter, against recorded responses", () => {
  it("parses real works into references at all", async () => {
    const outcome = await crossref().search({ text: "x" }, fetcherReturning(recorded));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // Catches a wholesale shape change while every synthetic test stays green.
    expect(outcome.references.length).toBeGreaterThan(0);
  });

  it("accounts for every record it was given", async () => {
    const outcome = await crossref().search({ text: "x" }, fetcherReturning(recorded));
    if (!outcome.ok) return;
    const total = (recorded as { message: { items: unknown[] } }).message.items.length;
    expect(outcome.references.length + outcome.dropped.length).toBe(total);
  });

  it("gets a real year out of most of them", async () => {
    const outcome = await crossref().search({ text: "x" }, fetcherReturning(recorded));
    if (!outcome.ok) return;
    const dated = outcome.references.filter((r) => typeof r.year === "number");
    // Not all — some records genuinely have no date. But a nested-tuple parse
    // that broke would yield none at all, which is the failure worth catching.
    expect(dated.length).toBeGreaterThan(outcome.references.length / 2);
    for (const reference of dated) {
      expect(reference.year).toBeGreaterThan(1500);
      expect(reference.year).toBeLessThan(2100);
    }
  });

  it("gets real author names, not empty strings or 'undefined undefined'", async () => {
    const outcome = await crossref().search({ text: "x" }, fetcherReturning(recorded));
    if (!outcome.ok) return;
    for (const reference of outcome.references) {
      for (const author of reference.authors) {
        expect(author.name.trim()).not.toBe("");
        expect(author.name).not.toContain("undefined");
      }
    }
  });

  it("normalises every DOI it produces", async () => {
    const outcome = await crossref().search({ text: "x" }, fetcherReturning(recorded));
    if (!outcome.ok) return;
    for (const reference of outcome.references) {
      if (!reference.doi) continue;
      expect(reference.doi).toMatch(/^10\.\d{4,9}\//);
      expect(reference.doi).toBe(reference.doi.toLowerCase());
    }
  });

  it("finds retracted works among the ones the recorder went looking for", async () => {
    const outcome = await crossref().search({ text: "x" }, fetcherReturning(recorded));
    if (!outcome.ok) return;
    const raw = (recorded as { message: { items: Array<Record<string, unknown>> } }).message.items;
    if (raw.some((item) => Array.isArray(item["updated-by"]))) {
      expect(outcome.references.some((r) => r.retraction === "confirmed")).toBe(true);
    }
  });
});

// Real recorded Crossref data returns works whose `updated-by` carries an
// erratum alongside a retraction, which means erratum-only works exist too. A
// correction is not a withdrawal: marking a corrected paper as retracted tells
// a researcher not to cite something perfectly citable.
describe("errata are not retractions", () => {
  it("does not mark a work carrying only an erratum as retracted", async () => {
    const outcome = await crossref().search({ text: "x" }, fetcherReturning(fixture));
    if (!outcome.ok) return;
    const corrected = outcome.references.find((r) => r.doi === "10.1000/fixture.corrected");
    expect(corrected).toBeDefined();
    expect(corrected?.retraction).toBe("none");
  });

  it("still catches a retraction listed alongside an erratum", async () => {
    // The shape real Crossref returns: ["erratum", "retraction"], in either order.
    const mixed = {
      status: "ok",
      message: {
        "total-results": 1,
        items: [{
          DOI: "10.1000/fixture.mixed",
          title: ["A retracted work whose record also lists an erratum"],
          issued: { "date-parts": [[2020]] },
          type: "journal-article",
          "updated-by": [
            { type: "erratum", DOI: "10.1000/a" },
            { type: "retraction", DOI: "10.1000/b" },
          ],
        }],
      },
    };
    const outcome = await crossref().search({ text: "x" }, fetcherReturning(mixed));
    if (!outcome.ok) return;
    expect(outcome.references[0]?.retraction).toBe("confirmed");
  });
});
