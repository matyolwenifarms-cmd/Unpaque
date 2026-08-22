import type { Reference } from "../reference.ts";

/**
 * Providers take their fetch as an argument.
 *
 * Same reason the diagnostic pipeline takes its model call: the adapter becomes
 * testable from Node against recorded responses, with no network and no keys,
 * and moving it behind a queue later is a change of transport rather than a
 * rewrite.
 */
export type Fetcher = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export interface SearchQuery {
  text: string;
  perPage?: number;
  /** Restrict to work published in or after this year. */
  fromYear?: number;
}

export type ProviderOutcome =
  | { ok: true; references: Reference[]; total: number; dropped: DroppedRecord[] }
  | { ok: false; status: number; message: string };

/**
 * A record the provider returned that could not become a Reference.
 *
 * Counted and reported rather than silently discarded. A search that quietly
 * drops a third of its results looks identical to one that found fewer, and the
 * person reading it has no way to tell which happened.
 */
export interface DroppedRecord {
  reason: "no_title" | "no_identifier";
  title?: string;
}

/**
 * How much a provider's own ordering means for a topical question.
 *
 * `primary` indexes what a work is *about* — OpenAlex holds inverted abstracts
 * and subject concepts, so asking it for media framing gets media framing.
 * `secondary` matches bibliographic metadata: it will answer, and its answer
 * for a bag of words is close to arbitrary. Crossref is the registration
 * agency, not a subject index, and a search there returns a great many trial
 * and dataset registrations whose titles happen to share a word.
 *
 * A secondary provider is still queried and still merged — it finds work the
 * primary one misses, and it is the only source that can settle a DOI or a
 * retraction. It simply does not get to decide what a researcher sees first.
 */
export type DiscoveryTier = "primary" | "secondary";

export interface SearchProvider {
  readonly name: string;
  /** Defaults to `primary`. See DiscoveryTier. */
  readonly discovery?: DiscoveryTier;
  search(query: SearchQuery, fetcher: Fetcher): Promise<ProviderOutcome>;
}
