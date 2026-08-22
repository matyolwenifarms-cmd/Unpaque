import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { leadingCaveat, quotationCaveat } from "../reference.ts";
import { openAlex } from "./openalex.ts";
import type { Fetcher } from "./types.ts";

// Hand-written, and named so nobody forgets it. It exercises every branch of
// the adapter exactly, and proves nothing about whether the adapter matches the
// real API — see the recorded suite at the bottom of this file.
const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../fixtures/openalex-synthetic.json", import.meta.url)), "utf8"),
);

function fetcherReturning(body: unknown, ok = true, status = 200): Fetcher {
  return async () => ({ ok, status, json: async () => body });
}

describe("the OpenAlex adapter, against synthetic fixtures", () => {
  it("turns a response into references", async () => {
    const outcome = await openAlex().search({ text: "framing theory" }, fetcherReturning(fixture));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.total).toBe(4831);
    expect(outcome.references).toHaveLength(5);
  });

  it("counts what it could not use rather than silently dropping it", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(fixture));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // The sixth fixture row has neither title nor id. A search that quietly
    // discards results looks identical to one that found fewer.
    expect(outcome.dropped).toEqual([{ reason: "no_title", title: undefined }]);
  });

  it("labels the preprint, because an unlabelled one is a citation nobody should make", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(fixture));
    if (!outcome.ok) return;
    const preprint = outcome.references.find((r) => r.doi === "10.1000/fixture.preprint");
    expect(preprint?.preprint).toBe(true);
  });

  it("does not label a published article as a preprint", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(fixture));
    if (!outcome.ok) return;
    const article = outcome.references.find((r) => r.doi === "10.1000/fixture.peer-reviewed");
    expect(article?.preprint).toBe(false);
  });

  it("carries retraction through", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(fixture));
    if (!outcome.ok) return;
    const retracted = outcome.references.find((r) => r.doi === "10.1000/fixture.retracted");
    // Contested, not confirmed. OpenAlex is an aggregator, and a recorded
    // search of it flagged the Lancet Commission's dementia report as
    // retracted — which is why its word alone does not settle the question.
    expect(retracted?.retraction).toBe("contested");
    expect(leadingCaveat(retracted!)).toMatch(/^Possibly retracted/);
  });

  it("offers no full-text URL for a paywalled work", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(fixture));
    if (!outcome.ok) return;
    const paywalled = outcome.references.find((r) => r.doi === "10.1000/fixture.paywalled");
    expect(paywalled?.fullText).toBeUndefined();
    expect(paywalled?.availability).toBe("metadata_only");
  });

  it("keeps a work that has a provider id but no DOI", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(fixture));
    if (!outcome.ok) return;
    expect(outcome.references.some((r) => r.id === "openalex:W1000000005")).toBe(true);
  });

  it("reports a bad status rather than throwing", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning({}, false, 429));
    expect(outcome).toEqual({ ok: false, status: 429, message: "openalex returned 429" });
  });

  it("survives an unreachable host", async () => {
    const outcome = await openAlex().search({ text: "x" }, async () => {
      throw new Error("ENOTFOUND");
    });
    expect(outcome.ok).toBe(false);
  });

  it("sends the contact email only when configured", async () => {
    const seen: string[] = [];
    const spy: Fetcher = async (url) => {
      seen.push(url);
      return { ok: true, status: 200, json: async () => fixture };
    };
    await openAlex().search({ text: "x" }, spy);
    await openAlex({ contactEmail: "someone@example.org" }).search({ text: "x" }, spy);
    expect(seen[0]).not.toContain("mailto");
    expect(seen[1]).toContain("mailto=someone%40example.org");
  });

  it("passes a year filter through", async () => {
    const spy = vi.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => fixture }));
    await openAlex().search({ text: "x", fromYear: 2020 }, spy as unknown as Fetcher);
    expect(String(spy.mock.calls[0]?.[0])).toContain("from_publication_date%3A2020-01-01");
  });

  it("caps per-page rather than letting a caller ask for the world", async () => {
    const spy = vi.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => fixture }));
    await openAlex().search({ text: "x", perPage: 5000 }, spy as unknown as Fetcher);
    expect(String(spy.mock.calls[0]?.[0])).toContain("per-page=200");
  });
});

// ---------------------------------------------------------------------------
// The same adapter, against whatever OpenAlex actually returned.
//
// `npm run research:record` writes this file. Until somebody does, these skip —
// and a skipped test is not a passing one. The suite above can be entirely
// green while the adapter has never once met the real API.
//
// The assertions here are invariants rather than specific rows, because the
// contents change every time it is recorded. A test pinned to a particular
// paper would go red for a reason that has nothing to do with the code.
// ---------------------------------------------------------------------------

function loadRecorded(): unknown | null {
  try {
    return JSON.parse(
      readFileSync(fileURLToPath(new URL("../fixtures/openalex-recorded.json", import.meta.url)), "utf8"),
    );
  } catch {
    return null;
  }
}

const recorded = loadRecorded();

describe.skipIf(recorded === null)("the OpenAlex adapter, against recorded responses", () => {
  it("parses real works into references at all", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(recorded));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // The single most valuable assertion in this file. If OpenAlex renames or
    // moves a field, every record fails to construct, this returns zero, and
    // the synthetic suite above stays perfectly green while the feature is
    // completely broken.
    expect(outcome.references.length).toBeGreaterThan(0);
  });

  it("accounts for every record it was given", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(recorded));
    if (!outcome.ok) return;
    const total = (recorded as { results: unknown[] }).results.length;
    expect(outcome.references.length + outcome.dropped.length).toBe(total);
  });

  it("gives every reference a resolvable identifier and a title", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(recorded));
    if (!outcome.ok) return;
    for (const reference of outcome.references) {
      expect(reference.doi ?? reference.providerId).toBeTruthy();
      expect(reference.title.trim()).not.toBe("");
      if (reference.doi) expect(reference.doi).toMatch(/^10\.\d{4,9}\//);
      if (reference.doi) expect(reference.doi).toBe(reference.doi.toLowerCase());
    }
  });

  it("never confirms a retraction on an aggregator's word alone", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(recorded));
    if (!outcome.ok) return;
    for (const reference of outcome.references) {
      // Real recorded data contains at least one false positive. Nothing from
      // this provider may reach `confirmed` without the registration agency.
      expect(reference.retraction).not.toBe("confirmed");
      if (reference.retraction === "contested") {
        expect(leadingCaveat(reference)).toMatch(/^Possibly retracted/);
      }
    }
  });

  it("labels the retracted works the recording deliberately went and fetched", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(recorded));
    if (!outcome.ok) return;
    const raw = (recorded as { results: Array<{ is_retracted?: boolean }> }).results;
    // The recorder queries is_retracted:true explicitly, so an absence here
    // means the flag stopped being read, not that none were returned.
    if (raw.some((work) => work.is_retracted === true)) {
      expect(outcome.references.some((r) => r.retraction === "contested")).toBe(true);
    }
  });

  it("labels the preprints the recording deliberately went and fetched", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(recorded));
    if (!outcome.ok) return;
    const raw = (recorded as { results: Array<{ type?: string }> }).results;
    if (raw.some((work) => work.type === "preprint")) {
      expect(outcome.references.some((r) => r.preprint)).toBe(true);
    }
  });

  it("issues no duplicate reference ids", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(recorded));
    if (!outcome.ok) return;
    const ids = outcome.references.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("full-text provenance from OpenAlex", () => {
  it("carries the version through rather than defaulting it to unknown", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(fixture));
    if (!outcome.ok) return;
    const published = outcome.references.find((r) => r.doi === "10.1000/fixture.peer-reviewed");
    expect(published?.fullText?.version).toBe("published");
  });

  it("marks a repository copy of a preprint as a submitted version", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(fixture));
    if (!outcome.ok) return;
    const preprint = outcome.references.find((r) => r.doi === "10.1000/fixture.preprint");
    expect(preprint?.fullText?.version).toBe("submitted");
    expect(preprint?.fullText?.host).toBe("repository");
  });

  it("attaches no full text at all to a paywalled work", async () => {
    const outcome = await openAlex().search({ text: "x" }, fetcherReturning(fixture));
    if (!outcome.ok) return;
    const paywalled = outcome.references.find((r) => r.doi === "10.1000/fixture.paywalled");
    expect(paywalled?.fullText).toBeUndefined();
    expect(quotationCaveat(paywalled!)).toMatch(/no passage can be shown/);
  });
});

describe("openalex's standing", () => {
  // The counterpart assertion. If both providers were secondary nothing would
  // be ranked at all, and the list would silently fall back to date order —
  // the exact failure this was built to stop.
  it("is a subject index, so its ordering decides", () => {
    expect(openAlex({}).discovery ?? "primary").toBe("primary");
  });
});
