import { describe, expect, it, vi } from "vitest";
import type { ResolveOutcome } from "./providers/crossref.ts";
import { fromProvider, type Reference } from "./reference.ts";
import { verificationSummary, verifyReferences, type Resolver } from "./verify.ts";

function ref(overrides: Partial<Reference> = {}): Reference {
  return {
    ...fromProvider({ source: "openalex", title: "A title", doi: "10.1000/abc", providerId: "W1" })!,
    ...overrides,
  };
}

const found = (retracted = false): ResolveOutcome => ({ state: "found", retracted, record: null });
const resolverReturning = (outcome: ResolveOutcome): Resolver => async () => outcome;

describe("verifying references", () => {
  it("upgrades a resolvable reference to verified", async () => {
    const outcome = await verifyReferences([ref()], resolverReturning(found()));
    expect(outcome.kept).toHaveLength(1);
    expect(outcome.kept[0]?.verification).toBe("verified");
    expect(outcome.dropped).toEqual([]);
    expect(outcome.unchecked).toEqual([]);
  });

  it("drops one whose identifier does not resolve, and says why", async () => {
    const outcome = await verifyReferences([ref()], resolverReturning({ state: "not_found" }));
    expect(outcome.kept).toEqual([]);
    expect(outcome.dropped).toHaveLength(1);
    expect(outcome.dropped[0]?.reason).toBe("not_found");
  });

  it("drops a malformed identifier", async () => {
    const outcome = await verifyReferences([ref()], resolverReturning({ state: "malformed" }));
    expect(outcome.dropped[0]?.reason).toBe("malformed");
  });

  // The most important test in this file. A resolver being down must never be
  // able to delete real references from somebody's bibliography — that failure
  // is silent, total, and looks exactly like the search finding less.
  it("KEEPS a reference the resolver could not be reached for", async () => {
    const outcome = await verifyReferences([ref()], resolverReturning({ state: "unreachable" }));
    expect(outcome.dropped).toEqual([]);
    expect(outcome.kept).toHaveLength(1);
    expect(outcome.unchecked).toHaveLength(1);
    expect(outcome.kept[0]?.verification).toBe("provider_only");
  });

  it("keeps a reference with no DOI without spending a lookup on it", async () => {
    const resolve = vi.fn(async (_doi: string): Promise<ResolveOutcome> => found());
    const noDoi = ref({ doi: undefined, id: "openalex:W1" });
    const outcome = await verifyReferences([noDoi], resolve);
    expect(outcome.kept).toHaveLength(1);
    expect(outcome.unchecked).toHaveLength(1);
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("retraction only ever ratchets upward", () => {
  it("marks retracted when the resolver says so and the provider did not", async () => {
    const outcome = await verifyReferences([ref({ retracted: false })], resolverReturning(found(true)));
    expect(outcome.kept[0]?.retracted).toBe(true);
  });

  // The asymmetry is the point. A wrong "retracted" costs a researcher one
  // double-check; a wrong "fine" costs them a retracted paper in a submitted
  // literature review.
  it("stays retracted when the provider said so and the resolver does not know", async () => {
    const outcome = await verifyReferences([ref({ retracted: true })], resolverReturning(found(false)));
    expect(outcome.kept[0]?.retracted).toBe(true);
  });
});

describe("being a good citizen of a free public API", () => {
  it("resolves in bounded batches rather than all at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const resolve: Resolver = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return found();
    };
    const references = Array.from({ length: 12 }, (_, i) =>
      ref({ doi: `10.1000/abc${i}`, id: `doi:10.1000/abc${i}` }));

    await verifyReferences(references, resolve, { concurrency: 3 });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("caps concurrency however enthusiastic the caller is", async () => {
    let peak = 0;
    let inFlight = 0;
    const resolve: Resolver = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return found();
    };
    const references = Array.from({ length: 40 }, (_, i) =>
      ref({ doi: `10.1000/abc${i}`, id: `doi:10.1000/abc${i}` }));

    await verifyReferences(references, resolve, { concurrency: 500 });
    expect(peak).toBeLessThanOrEqual(10);
  });

  it("checks every reference it was given", async () => {
    const resolve = vi.fn(async (_doi: string): Promise<ResolveOutcome> => found());
    const references = Array.from({ length: 7 }, (_, i) =>
      ref({ doi: `10.1000/abc${i}`, id: `doi:10.1000/abc${i}` }));
    const outcome = await verifyReferences(references, resolve, { concurrency: 3 });
    expect(resolve).toHaveBeenCalledTimes(7);
    expect(outcome.kept).toHaveLength(7);
  });
});

describe("the sentence a researcher reads", () => {
  it("gives the numbers together, because separately they mean nothing", async () => {
    const outcome = {
      kept: [ref(), ref(), ref()],
      unchecked: [ref()],
      dropped: [{ reference: ref(), reason: "not_found" as const }],
    };
    expect(verificationSummary(outcome)).toBe(
      "2 verified, 1 unchecked, 1 dropped — the identifier did not resolve",
    );
  });

  it("says nothing about drops when there were none", async () => {
    expect(verificationSummary({ kept: [ref()], unchecked: [], dropped: [] })).toBe("1 verified");
  });
});
