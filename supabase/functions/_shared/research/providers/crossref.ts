import { fromProvider, normaliseDoi, type Reference } from "../reference.ts";
import type { DroppedRecord, Fetcher, ProviderOutcome, SearchProvider, SearchQuery } from "./types.ts";

// Crossref is the DOI registration agency's own metadata. That makes it the
// authority for one specific question — does this DOI exist, and what is
// registered against it — which is what the verification pass needs and what
// OpenAlex, being an aggregator, cannot answer with the same standing.
//
// Its response shape is its own. `title` and `container-title` are arrays, a
// year lives inside a nested date-parts tuple, and retraction is expressed as a
// relationship to another record rather than a flag. Every one of those is a
// place where a careless adapter produces a reference that looks right and is
// wrong, which is why each has its own helper and its own test.

const BASE = "https://api.crossref.org/works";

export interface CrossrefOptions {
  /** Sent as `mailto` for the polite pool. A request, not authentication. */
  contactEmail?: string;
}

/** Crossref's own words for a work being withdrawn. All three mean "do not cite". */
const RETRACTION_TYPES = ["retraction", "withdrawal", "removal"];

export function crossref(options: CrossrefOptions = {}): SearchProvider & {
  resolve(doi: string, fetcher: Fetcher): Promise<ResolveOutcome>;
} {
  return {
    name: "crossref",

    async search(query: SearchQuery, fetcher: Fetcher): Promise<ProviderOutcome> {
      const params = new URLSearchParams({
        query: query.text,
        rows: String(Math.min(query.perPage ?? 25, 100)),
      });
      if (query.fromYear) params.set("filter", `from-pub-date:${query.fromYear}-01-01`);
      if (options.contactEmail) params.set("mailto", options.contactEmail);

      let response;
      try {
        response = await fetcher(`${BASE}?${params.toString()}`, {
          headers: { Accept: "application/json" },
        });
      } catch (error) {
        return { ok: false, status: 0, message: `crossref unreachable: ${String(error)}` };
      }
      if (!response.ok) {
        return { ok: false, status: response.status, message: `crossref returned ${response.status}` };
      }

      const body = (await response.json()) as Record<string, unknown>;
      const message = (body.message ?? {}) as Record<string, unknown>;
      const items = Array.isArray(message.items) ? message.items : [];

      const references: Reference[] = [];
      const dropped: DroppedRecord[] = [];
      for (const raw of items) {
        const reference = toReference(raw as Record<string, unknown>);
        if (reference) references.push(reference);
        else {
          const title = firstOf((raw as Record<string, unknown>).title);
          dropped.push({ reason: title ? "no_identifier" : "no_title", title });
        }
      }

      const total = message["total-results"];
      return { ok: true, references, total: typeof total === "number" ? total : references.length, dropped };
    },

    async resolve(doi: string, fetcher: Fetcher): Promise<ResolveOutcome> {
      const normalised = normaliseDoi(doi);
      // A malformed DOI is not "unresolved pending a lookup" — it cannot be one,
      // and spending a request to discover that would be silly.
      if (!normalised) return { state: "malformed" };

      const suffix = options.contactEmail
        ? `?mailto=${encodeURIComponent(options.contactEmail)}`
        : "";
      let response;
      try {
        response = await fetcher(`${BASE}/${encodeURIComponent(normalised)}${suffix}`, {
          headers: { Accept: "application/json" },
        });
      } catch {
        // Unreachable is not the same as absent. A network failure must never
        // be recorded as "this paper does not exist" — that would drop real
        // references from a bibliography because someone's wifi dropped.
        return { state: "unreachable" };
      }

      if (response.status === 404) return { state: "not_found" };
      if (!response.ok) return { state: "unreachable" };

      const body = (await response.json()) as Record<string, unknown>;
      const message = (body.message ?? {}) as Record<string, unknown>;
      return { state: "found", retracted: isRetracted(message), record: toReference(message) };
    },
  };
}

export type ResolveOutcome =
  | { state: "found"; retracted: boolean; record: Reference | null }
  | { state: "not_found" }
  | { state: "malformed" }
  | { state: "unreachable" };

function toReference(work: Record<string, unknown>): Reference | null {
  return fromProvider({
    source: "crossref",
    title: firstOf(work.title),
    doi: work.DOI,
    providerId: typeof work.DOI === "string" ? work.DOI : undefined,
    authors: authorsOf(work),
    year: yearOf(work),
    venue: firstOf(work["container-title"]),
    preprint: isPreprint(work),
    retracted: isRetracted(work),
    // Crossref registers retractions. Its word is the record, not a report of
    // the record, which is the whole reason a Crossref flag confirms and an
    // OpenAlex flag only contests.
    retractionAuthority: true,
    // Crossref describes licences and links, not open-access status. Claiming
    // full text from a `link` entry would be a guess, and a guess here produces
    // a passage quoted from something nobody retrieved.
    openAccess: false,
    landingPageUrl: typeof work.URL === "string" ? work.URL : undefined,
    citedByCount: typeof work["is-referenced-by-count"] === "number"
      ? work["is-referenced-by-count"]
      : undefined,
  });
}

/** Crossref returns titles as arrays. The first entry is the title of record. */
function firstOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return undefined;
  const first = value[0];
  return typeof first === "string" && first.trim() !== "" ? first : undefined;
}

/**
 * `issued.date-parts` is `[[year, month, day]]`, with month and day optional
 * and the whole thing occasionally `[[null]]` for a work with no known date.
 */
function yearOf(work: Record<string, unknown>): number | undefined {
  for (const key of ["issued", "published", "published-print", "published-online", "created"]) {
    const field = work[key];
    if (typeof field !== "object" || field === null) continue;
    const parts = (field as Record<string, unknown>)["date-parts"];
    if (!Array.isArray(parts) || !Array.isArray(parts[0])) continue;
    const year = (parts[0] as unknown[])[0];
    if (typeof year === "number" && Number.isInteger(year)) return year;
  }
  return undefined;
}

/**
 * A retracted work carries `updated-by` pointing at the notice. The notice
 * itself carries `update-to` pointing back — and is not itself retracted, so
 * reading the wrong direction marks every retraction notice as a retracted
 * paper and lets the actual retracted papers through clean.
 */
function isRetracted(work: Record<string, unknown>): boolean {
  const updatedBy = work["updated-by"];
  if (!Array.isArray(updatedBy)) return false;
  return updatedBy.some((update) => {
    const type = (update as Record<string, unknown>)?.type;
    return typeof type === "string" && RETRACTION_TYPES.includes(type.toLowerCase());
  });
}

function isPreprint(work: Record<string, unknown>): boolean {
  if (work.subtype === "preprint") return true;
  return work.type === "posted-content";
}

function authorsOf(work: Record<string, unknown>): Array<{ name?: unknown; id?: unknown }> {
  const authors = work.author;
  if (!Array.isArray(authors)) return [];
  return authors.map((entry) => {
    const author = entry as Record<string, unknown>;
    const given = typeof author.given === "string" ? author.given.trim() : "";
    const family = typeof author.family === "string" ? author.family.trim() : "";
    // A corporate author has `name` and neither given nor family.
    const name = [given, family].filter(Boolean).join(" ") ||
      (typeof author.name === "string" ? author.name : "");
    return { name, id: typeof author.ORCID === "string" ? author.ORCID : undefined };
  });
}
