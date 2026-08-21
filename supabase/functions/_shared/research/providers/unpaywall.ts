import { FULL_TEXT_VERSIONS, normaliseDoi, type FullTextVersion } from "../reference.ts";
import type { Fetcher } from "./types.ts";

// Unpaywall finds a legal open-access copy of a paywalled paper — an author
// manuscript in a repository, a publisher's own free version, a deposit made
// under a funder mandate. It is free, needs no key, and is the single highest
// leverage integration available to this feature: it converts references that
// would otherwise be metadata_only into ones a researcher can actually quote.
//
// It requires an email address as a query parameter rather than merely asking
// for one, so this adapter refuses to construct without one instead of making
// a request that will come back 422.

const BASE = "https://api.unpaywall.org/v2";

export interface OpenAccessLocation {
  url: string;
  pdfUrl?: string;
  landingPageUrl?: string;
  /** "publisher" or "repository", per Unpaywall. */
  hostType?: string;
  version: FullTextVersion;
  /** e.g. "cc-by". Absent means the terms are unstated, not that they are open. */
  licence?: string;
}

export type LocateOutcome =
  | { state: "open"; location: OpenAccessLocation }
  | { state: "closed" }
  | { state: "not_found" }
  | { state: "malformed" }
  | { state: "unreachable" };

export interface UnpaywallOptions {
  /** Required by the API, not merely polite. */
  contactEmail: string;
}

export function unpaywall(options: UnpaywallOptions) {
  if (!options.contactEmail || !options.contactEmail.includes("@")) {
    throw new Error("unpaywall requires a contact email address");
  }

  return {
    name: "unpaywall",

    async locate(doi: string, fetcher: Fetcher): Promise<LocateOutcome> {
      const normalised = normaliseDoi(doi);
      if (!normalised) return { state: "malformed" };

      const url = `${BASE}/${encodeURIComponent(normalised)}?email=${encodeURIComponent(options.contactEmail)}`;
      let response;
      try {
        response = await fetcher(url, { headers: { Accept: "application/json" } });
      } catch {
        // Unreachable is never "closed". Treating a network failure as "no open
        // copy exists" would silently strip the passage feature from every
        // reference during an outage, and look exactly like the papers simply
        // being paywalled.
        return { state: "unreachable" };
      }

      if (response.status === 404) return { state: "not_found" };
      if (!response.ok) return { state: "unreachable" };

      const body = (await response.json()) as Record<string, unknown>;
      if (body.is_oa !== true) return { state: "closed" };

      const best = pickLocation(body);
      // is_oa true with no usable location happens. Without a URL there is
      // nothing to retrieve, so it is closed as far as this feature is
      // concerned — claiming otherwise would promise a passage that can never
      // arrive.
      if (!best) return { state: "closed" };

      return { state: "open", location: best };
    },
  };
}

function pickLocation(body: Record<string, unknown>): OpenAccessLocation | null {
  const candidates: Array<Record<string, unknown>> = [];
  const best = body.best_oa_location;
  if (typeof best === "object" && best !== null) candidates.push(best as Record<string, unknown>);
  const all = body.oa_locations;
  if (Array.isArray(all)) {
    for (const entry of all) {
      if (typeof entry === "object" && entry !== null) candidates.push(entry as Record<string, unknown>);
    }
  }

  // Unpaywall's own best_oa_location is tried first, then the rest in the order
  // given — but a published version anywhere outranks an accepted one, because
  // quoting the version of record is worth more than any host preference.
  const scored = candidates
    .map((candidate) => ({ candidate, version: versionOf(candidate) }))
    .filter(({ candidate }) => typeof urlOf(candidate) === "string");

  if (scored.length === 0) return null;
  const published = scored.find(({ version }) => version === "published");
  const chosen = published ?? scored[0]!;
  const candidate = chosen.candidate;

  return {
    url: urlOf(candidate)!,
    pdfUrl: typeof candidate.url_for_pdf === "string" ? candidate.url_for_pdf : undefined,
    landingPageUrl: typeof candidate.url_for_landing_page === "string"
      ? candidate.url_for_landing_page
      : undefined,
    hostType: typeof candidate.host_type === "string" ? candidate.host_type : undefined,
    version: chosen.version,
    licence: typeof candidate.license === "string" ? candidate.license : undefined,
  };
}

function urlOf(candidate: Record<string, unknown>): string | undefined {
  for (const key of ["url_for_pdf", "url", "url_for_landing_page"]) {
    const value = candidate[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
}

function versionOf(candidate: Record<string, unknown>): FullTextVersion {
  void FULL_TEXT_VERSIONS;
  switch (candidate.version) {
    case "publishedVersion":
      return "published";
    case "acceptedVersion":
      return "accepted";
    case "submittedVersion":
      return "submitted";
    default:
      return "unknown";
  }
}
