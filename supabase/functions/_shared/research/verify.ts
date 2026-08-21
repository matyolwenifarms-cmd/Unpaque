import type { ResolveOutcome } from "./providers/crossref.ts";
import type { Reference } from "./reference.ts";

// The verification pass. Every identifier is re-resolved against the
// registration agency before the reference is allowed near a screen.
//
// This is the difference between "a search engine returned this" and "this
// exists". Aggregators carry stale and merged records; a DOI that 404s at
// Crossref will 404 in a marker's browser too, and at that point it is
// indistinguishable from a citation somebody made up.

export type Resolver = (doi: string) => Promise<ResolveOutcome>;

export interface DroppedReference {
  reference: Reference;
  reason: "not_found" | "malformed";
}

export interface VerifyOutcome {
  /** Safe to display. */
  kept: Reference[];
  /**
   * Removed, and reported. Never silently discarded: a reference list that
   * quietly loses three entries looks identical to a search that found three
   * fewer, and the researcher has no way to tell which happened.
   */
  dropped: DroppedReference[];
  /**
   * Kept, but not checked — the resolver could not be reached. These stay
   * `provider_only` and the interface should say so.
   */
  unchecked: Reference[];
}

export interface VerifyOptions {
  /**
   * Simultaneous lookups. Crossref is a free public service run for everyone;
   * hammering it is both rude and the fastest way to be rate-limited into
   * failing the very check this exists to perform.
   */
  concurrency?: number;
}

export async function verifyReferences(
  references: Reference[],
  resolve: Resolver,
  options: VerifyOptions = {},
): Promise<VerifyOutcome> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 10));
  const outcome: VerifyOutcome = { kept: [], dropped: [], unchecked: [] };

  for (let start = 0; start < references.length; start += concurrency) {
    const batch = references.slice(start, start + concurrency);
    const results = await Promise.all(batch.map((reference) => check(reference, resolve)));
    for (const result of results) {
      if (result.kind === "kept") outcome.kept.push(result.reference);
      else if (result.kind === "unchecked") {
        outcome.kept.push(result.reference);
        outcome.unchecked.push(result.reference);
      } else outcome.dropped.push({ reference: result.reference, reason: result.reason });
    }
  }

  return outcome;
}

type CheckResult =
  | { kind: "kept"; reference: Reference }
  | { kind: "unchecked"; reference: Reference }
  | { kind: "dropped"; reference: Reference; reason: "not_found" | "malformed" };

async function check(reference: Reference, resolve: Resolver): Promise<CheckResult> {
  // No DOI is not a failure. Plenty of legitimate scholarship — theses,
  // reports, older proceedings — has never had one. It stays provider_only,
  // which the interface shows, rather than being thrown away for lacking an
  // identifier its discipline does not use.
  if (!reference.doi) return { kind: "unchecked", reference };

  const result = await resolve(reference.doi);

  switch (result.state) {
    case "found":
      return {
        kind: "kept",
        reference: {
          ...reference,
          verification: "verified",
          // The registration agency can confirm a retraction. It cannot clear
          // one: a retraction that has been published but not yet registered is
          // ordinary, so Crossref's silence is not evidence of absence. An
          // aggregator's unconfirmed flag therefore stays `contested` and the
          // researcher is told to check, rather than either side winning.
          retraction: result.retracted
            ? "confirmed"
            : reference.retraction === "confirmed"
              ? "confirmed"
              : reference.retraction,
        },
      };

    case "not_found":
      return { kind: "dropped", reference, reason: "not_found" };

    case "malformed":
      return { kind: "dropped", reference, reason: "malformed" };

    case "unreachable":
      // Emphatically not a drop. A resolver that is down must never be able to
      // delete real references from somebody's bibliography — the failure mode
      // of treating unreachable as absent is silent, total, and looks exactly
      // like the search simply finding less.
      return { kind: "unchecked", reference };
  }
}

/**
 * A sentence for the researcher about what verification did.
 *
 * Written out rather than left to the interface because the numbers only mean
 * something together: "18 of 21 verified" is informative, "18 references" is
 * not, and a silent 21 would be a lie of omission.
 */
export function verificationSummary(outcome: VerifyOutcome): string {
  const verified = outcome.kept.length - outcome.unchecked.length;
  const parts = [`${verified} verified`];
  if (outcome.unchecked.length > 0) parts.push(`${outcome.unchecked.length} unchecked`);
  if (outcome.dropped.length > 0) {
    parts.push(`${outcome.dropped.length} dropped — the identifier did not resolve`);
  }
  return parts.join(", ");
}
