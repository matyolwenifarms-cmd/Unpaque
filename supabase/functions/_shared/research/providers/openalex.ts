import { fromProvider, type Reference } from "../reference.ts";
import type { DroppedRecord, Fetcher, ProviderOutcome, SearchProvider, SearchQuery } from "./types.ts";

// OpenAlex: about 250 million works, every discipline, no API key, no cost.
// The right default for a tool that has to serve any researcher who turns up.
//
// It asks callers to identify themselves by email in exchange for the faster
// pool. That is a request rather than authentication, and there is nothing
// secret about it — but it is still a person's address, so it is configured,
// never hard-coded.

const BASE = "https://api.openalex.org/works";

export interface OpenAlexOptions {
  /** Sent as `mailto` for the polite pool. Optional; omit and requests still work. */
  contactEmail?: string;
}

export function openAlex(options: OpenAlexOptions = {}): SearchProvider {
  return {
    name: "openalex",
    async search(query: SearchQuery, fetcher: Fetcher): Promise<ProviderOutcome> {
      const params = new URLSearchParams({
        search: query.text,
        "per-page": String(Math.min(query.perPage ?? 25, 200)),
      });
      if (query.fromYear) params.set("filter", `from_publication_date:${query.fromYear}-01-01`);
      if (options.contactEmail) params.set("mailto", options.contactEmail);

      let response;
      try {
        response = await fetcher(`${BASE}?${params.toString()}`, {
          headers: { Accept: "application/json" },
        });
      } catch (error) {
        return { ok: false, status: 0, message: `openalex unreachable: ${String(error)}` };
      }

      if (!response.ok) {
        return { ok: false, status: response.status, message: `openalex returned ${response.status}` };
      }

      const body = (await response.json()) as Record<string, unknown>;
      const results = Array.isArray(body.results) ? body.results : [];
      const references: Reference[] = [];
      const dropped: DroppedRecord[] = [];

      // The index is the rank. OpenAlex answers in relevance order; see the note
      // on `providerRank` for what discarding it did.
      for (const [rank, raw] of results.entries()) {
        const work = raw as Record<string, unknown>;
        const reference = fromProvider({
          source: "openalex",
          rank,
          title: work.display_name ?? work.title,
          doi: work.doi,
          providerId: work.id,
          authors: authorsOf(work),
          year: work.publication_year,
          venue: venueOf(work),
          preprint: isPreprint(work),
          retracted: work.is_retracted === true,
          openAccess: openAccessOf(work).isOa,
          fullText: fullTextOf(work),
          landingPageUrl: locationOf(work)?.landing_page_url,
          citedByCount: work.cited_by_count,
        });

        if (reference) references.push(reference);
        else {
          const title = typeof work.display_name === "string" ? work.display_name : undefined;
          dropped.push({ reason: title ? "no_identifier" : "no_title", title });
        }
      }

      const meta = (body.meta ?? {}) as Record<string, unknown>;
      return {
        ok: true,
        references,
        total: typeof meta.count === "number" ? meta.count : references.length,
        dropped,
      };
    },
  };
}

function locationOf(work: Record<string, unknown>): Record<string, unknown> | undefined {
  const location = work.primary_location ?? work.best_oa_location;
  return typeof location === "object" && location !== null
    ? (location as Record<string, unknown>)
    : undefined;
}

function venueOf(work: Record<string, unknown>): string | undefined {
  const source = locationOf(work)?.source;
  if (typeof source !== "object" || source === null) return undefined;
  const name = (source as Record<string, unknown>).display_name;
  return typeof name === "string" ? name : undefined;
}

/**
 * A preprint is anything OpenAlex types as one, or anything whose only home is
 * a repository rather than a published venue. Erring toward labelling: an
 * over-labelled peer-reviewed paper costs a reader one moment of doubt, an
 * under-labelled preprint costs them a citation they should not have made.
 */
function isPreprint(work: Record<string, unknown>): boolean {
  if (work.type === "preprint") return true;
  const location = locationOf(work);
  if (location?.version === "submittedVersion") return true;
  const source = location?.source;
  if (typeof source === "object" && source !== null) {
    return (source as Record<string, unknown>).type === "repository";
  }
  return false;
}

/**
 * OpenAlex records a version on the location, so it is carried through rather
 * than defaulted to unknown. A repository copy is very often an accepted
 * manuscript, and a passage quoted from one has to say so.
 */
function fullTextOf(work: Record<string, unknown>) {
  const { isOa, url } = openAccessOf(work);
  if (!isOa || !url) return undefined;
  const location = locationOf(work);
  const raw = location?.version;
  const version = raw === "publishedVersion"
    ? "published"
    : raw === "acceptedVersion"
      ? "accepted"
      : raw === "submittedVersion"
        ? "submitted"
        : "unknown";
  const source = location?.source;
  const host = typeof source === "object" && source !== null
    ? (source as Record<string, unknown>).type
    : undefined;
  return { url, version, host: typeof host === "string" ? host : undefined };
}

function openAccessOf(work: Record<string, unknown>): { isOa: boolean; url?: string } {
  const oa = work.open_access;
  if (typeof oa !== "object" || oa === null) return { isOa: false };
  const record = oa as Record<string, unknown>;
  const url = typeof record.oa_url === "string" ? record.oa_url : undefined;
  return { isOa: record.is_oa === true, url: record.is_oa === true ? url : undefined };
}

function authorsOf(work: Record<string, unknown>): Array<{ name?: unknown; id?: unknown }> {
  const authorships = work.authorships;
  if (!Array.isArray(authorships)) return [];
  return authorships.map((entry) => {
    const author = (entry as Record<string, unknown>)?.author;
    if (typeof author !== "object" || author === null) return {};
    const record = author as Record<string, unknown>;
    return { name: record.display_name, id: record.id };
  });
}
