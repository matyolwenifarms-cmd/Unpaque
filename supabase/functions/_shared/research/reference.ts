// A reference exists because a bibliographic provider returned it. There is no
// other way to make one, and that is the entire point of this module.
//
// Asked for references, a language model invents them: plausible authors,
// plausible titles, plausible years, DOIs that resolve to nothing. It is the
// best-documented failure mode of the technology, and for the person this
// feature is built for it is not an inconvenience — a fabricated citation in a
// submitted literature review is a research-integrity finding against them.
//
// Prompting cannot fix that; only structure can. So `Reference` is constructed
// by `fromProvider()` alone, the model's tool schema will accept only ids
// already retrieved this session, and anything without a resolvable identifier
// never reaches a screen. The model ranks and explains. It does not supply.

export const REFERENCE_STATUSES = [
  "verified",
  "provider_only",
  "full_text",
  "metadata_only",
  "unresolvable",
  "user_supplied",
  "retracted",
] as const;

export type ReferenceStatus = (typeof REFERENCE_STATUSES)[number];

export interface Author {
  name: string;
  /** Provider identifier, where one was given. Never invented. */
  id?: string;
}

export interface Reference {
  /** Stable within a session. What the model is allowed to cite. */
  id: string;
  /** The provider that returned it. Provenance is not optional. */
  source: string;
  /** Canonical DOI, lower-cased, no URL prefix. Absent is legitimate. */
  doi?: string;
  /** The provider's own identifier, e.g. an OpenAlex work id. */
  providerId?: string;
  title: string;
  authors: Author[];
  year?: number;
  /** Journal, conference or repository name. */
  venue?: string;
  /**
   * True where the provider says this is a preprint or otherwise not peer
   * reviewed. A preprint displayed without that label is a defect, not a
   * styling choice — it is the difference between evidence and a claim.
   */
  preprint: boolean;
  retracted: boolean;
  openAccess: boolean;
  /** Where the full text can be fetched, when it is openly available. */
  fullTextUrl?: string;
  landingPageUrl?: string;
  citedByCount?: number;
  status: ReferenceStatus;
}

/** Strip the URL wrapper providers put around DOIs, and case-fold. */
export function normaliseDoi(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "") return undefined;
  const withoutPrefix = trimmed
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:/, "");
  // A DOI is "10." followed by a registrant and a suffix. Anything else is not
  // one, and passing it on as though it were produces a link that 404s in a
  // reference list — which looks exactly like a fabricated citation.
  return /^10\.\d{4,9}\/\S+$/.test(withoutPrefix) ? withoutPrefix : undefined;
}

/** Strip the URL wrapper from an OpenAlex-style id: W2741809807. */
export function shortProviderId(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const segments = raw.trim().split("/");
  return segments[segments.length - 1] || undefined;
}

export interface ProviderRecord {
  source: string;
  title?: unknown;
  doi?: unknown;
  providerId?: unknown;
  authors?: Array<{ name?: unknown; id?: unknown }>;
  year?: unknown;
  venue?: unknown;
  preprint?: unknown;
  retracted?: unknown;
  openAccess?: unknown;
  fullTextUrl?: unknown;
  landingPageUrl?: unknown;
  citedByCount?: unknown;
}

/**
 * The only constructor.
 *
 * Returns null rather than a partial reference when there is no title or no
 * identifier at all: a row that cannot be looked up is not a citation, it is a
 * rumour, and showing it with a caveat would still put it in front of somebody
 * who is going to paste it into a bibliography.
 */
export function fromProvider(record: ProviderRecord): Reference | null {
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (title === "") return null;

  const doi = normaliseDoi(record.doi);
  const providerId = shortProviderId(record.providerId);
  if (!doi && !providerId) return null;

  const retracted = record.retracted === true;
  const openAccess = record.openAccess === true;
  const fullTextUrl = typeof record.fullTextUrl === "string" ? record.fullTextUrl : undefined;

  return {
    id: doi ? `doi:${doi}` : `${record.source}:${providerId}`,
    source: record.source,
    doi,
    providerId,
    title,
    // Mapped to Author first, then filtered on a plain boolean. A type
    // predicate here does not compile: Author's `id` is optional, and an
    // optional property is not assignable to the required `string | undefined`
    // the mapped object would otherwise infer.
    authors: (record.authors ?? [])
      .map((author): Author => ({
        name: typeof author.name === "string" ? author.name.trim() : "",
        id: shortProviderId(author.id),
      }))
      .filter((author) => author.name !== ""),
    year: typeof record.year === "number" && Number.isInteger(record.year) ? record.year : undefined,
    venue: typeof record.venue === "string" && record.venue.trim() !== "" ? record.venue.trim() : undefined,
    preprint: record.preprint === true,
    retracted,
    openAccess,
    fullTextUrl,
    landingPageUrl: typeof record.landingPageUrl === "string" ? record.landingPageUrl : undefined,
    citedByCount: typeof record.citedByCount === "number" ? record.citedByCount : undefined,
    // Retraction outranks everything: a retracted paper with open full text is
    // still first and foremost retracted, and a reader who sees "full text"
    // before they see "retracted" has been told the wrong thing first.
    status: retracted ? "retracted" : fullTextUrl ? "full_text" : "metadata_only",
  };
}

/**
 * Newest first, which is what was asked for — but ties break on citation count,
 * because a reference list ordered purely by date buries the foundational work
 * every examiner expects to see.
 */
export function byRecencyThenInfluence(a: Reference, b: Reference): number {
  if (a.year !== b.year) return (b.year ?? 0) - (a.year ?? 0);
  return (b.citedByCount ?? 0) - (a.citedByCount ?? 0);
}
