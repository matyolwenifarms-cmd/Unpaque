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

// Two independent axes, deliberately not one field.
//
// The specification's §3 table lists VERIFIED, FULL_TEXT, METADATA_ONLY and
// UNRESOLVABLE together as though they were mutually exclusive states, and
// modelling them that way does not survive contact with the feature: the best
// case a researcher can have is a reference that is *both* verified and has
// full text, and a single field forces the verification pass to overwrite
// availability to record its own result. That would silently destroy the one
// fact the passage engine depends on.
//
// So: how well do we know this reference exists, and can we read it. A
// reference can be verified and paywalled, provider-only and open, or any
// other combination. `retracted` is a third axis again and stays a boolean,
// because a retracted paper is still retracted whatever else is true of it.

export const VERIFICATIONS = ["verified", "provider_only", "unresolvable", "user_supplied"] as const;
export type Verification = (typeof VERIFICATIONS)[number];

export const AVAILABILITIES = ["full_text", "metadata_only"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

// Retraction is three-valued, not a boolean, and real data is what forced it.
//
// A recorded OpenAlex search flagged `is_retracted` on the Lancet Commission's
// 2020 dementia report — a standing, heavily cited paper with no retraction
// marker anywhere in its title, sitting alongside two genuine retractions that
// both announce themselves in their titles. Aggregators get this wrong.
//
// The first design let retraction ratchet upward: if any source said retracted,
// it was retracted, on the reasoning that a false "retracted" costs a
// double-check and a false "fine" costs a citation. That reasoning is right
// about a single reference and wrong about the product. A researcher shown a
// paper they know perfectly well is fine, labelled Retracted, learns that the
// labels are unreliable — and then disbelieves the true one further down.
//
// So a disagreement is shown as a disagreement. This is the Detective
// specification's §4 CONTESTED, applied here: show the conflict, do not
// silently choose a side. `confirmed` requires the registration agency;
// an aggregator alone gets `contested`, which tells the researcher to look.
/**
 * Which version of a paper an open copy actually is.
 *
 * Not bookkeeping. An accepted manuscript is the text after peer review and
 * before the publisher's copy-editing and typesetting: wording can differ and
 * pagination almost always does. A passage quoted from one and cited against
 * the published record can send a marker to a page where the sentence is not —
 * which from their side is indistinguishable from a quotation somebody made up.
 *
 * So the version travels with the text, and the interface says which it is.
 */
export const FULL_TEXT_VERSIONS = ["published", "accepted", "submitted", "unknown"] as const;
export type FullTextVersion = (typeof FULL_TEXT_VERSIONS)[number];

export interface FullText {
  url: string;
  pdfUrl?: string;
  version: FullTextVersion;
  /** e.g. "cc-by". Absent means the terms are unstated, not that they are open. */
  licence?: string;
  /** "publisher", "repository". Where the copy actually lives. */
  host?: string;
}

export const RETRACTION_STATES = ["none", "contested", "confirmed"] as const;
export type RetractionState = (typeof RETRACTION_STATES)[number];

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
  /** `confirmed` only from a registration agency. See RETRACTION_STATES. */
  retraction: RetractionState;
  openAccess: boolean;
  /**
   * The open copy, when there is one, with its provenance. Absent means
   * `availability` is metadata_only and no passage may be shown.
   */
  fullText?: FullText;
  landingPageUrl?: string;
  citedByCount?: number;
  /** How well we know this exists. Upgraded by the verification pass. */
  verification: Verification;
  /**
   * Whether the full text can be retrieved. `metadata_only` is the state in
   * which **no passage may be displayed** — the reference still lists, and the
   * interface says why there is no quotation rather than generating one.
   */
  availability: Availability;
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
  /**
   * True only for a source that registers retractions — Crossref, and any
   * other registration agency. An aggregator repeating a retraction is
   * evidence, not the record, and must not set `confirmed`.
   */
  retractionAuthority?: boolean;
  openAccess?: unknown;
  fullText?: { url?: unknown; pdfUrl?: unknown; version?: unknown; licence?: unknown; host?: unknown };
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

  const flagged = record.retracted === true;
  const retraction: RetractionState = flagged
    ? record.retractionAuthority === true
      ? "confirmed"
      : "contested"
    : "none";
  const openAccess = record.openAccess === true;
  const fullText = toFullText(record.fullText);

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
    retraction,
    openAccess,
    fullText,
    landingPageUrl: typeof record.landingPageUrl === "string" ? record.landingPageUrl : undefined,
    citedByCount: typeof record.citedByCount === "number" ? record.citedByCount : undefined,
    // A provider returning something is not the same as that identifier
    // resolving. Nothing here has been checked against the registration
    // agency yet, so it starts at provider_only and the verification pass
    // upgrades it.
    verification: "provider_only",
    availability: fullText ? "full_text" : "metadata_only",
  };
}

function toFullText(value: ProviderRecord["fullText"]): FullText | undefined {
  if (!value || typeof value.url !== "string" || value.url.trim() === "") return undefined;
  // An unrecognised version string becomes "unknown" rather than being passed
  // through. A version nobody can interpret is not better than admitting the
  // version is not known — it is worse, because it looks authoritative.
  const version: FullTextVersion =
    typeof value.version === "string" && (FULL_TEXT_VERSIONS as readonly string[]).includes(value.version)
      ? (value.version as FullTextVersion)
      : "unknown";
  return {
    url: value.url,
    pdfUrl: typeof value.pdfUrl === "string" ? value.pdfUrl : undefined,
    version,
    licence: typeof value.licence === "string" ? value.licence : undefined,
    host: typeof value.host === "string" ? value.host : undefined,
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

/**
 * How a reference should be introduced to a reader, most important first.
 *
 * Retraction leads, always. A reader who sees "full text available" before
 * they see "retracted" has been told the wrong thing first, and the second
 * fact does not undo the first impression. After that, doubt about whether the
 * thing exists outranks convenience about reading it.
 */
export function leadingCaveat(reference: Reference): string | null {
  if (reference.retraction === "confirmed") return "Retracted";
  // Deliberately phrased as a prompt to check rather than as a finding. Naming
  // the disagreement is the honest thing to put in front of somebody who is
  // about to cite it; asserting either side is not.
  if (reference.retraction === "contested") return "Possibly retracted — sources disagree, check before citing";
  if (reference.verification === "unresolvable") return "Identifier did not resolve";
  if (reference.preprint) return "Preprint — not peer reviewed";
  if (reference.verification === "user_supplied") return "Added by you — not verified";
  if (reference.availability === "metadata_only") return "Full text not openly available";
  return null;
}

/**
 * Attach an open copy found after the fact — by Unpaywall, typically — and
 * upgrade availability with it.
 *
 * Returns a new reference rather than mutating, so a caller cannot half-apply
 * this and end up with `availability: "full_text"` and nothing to read.
 */
export function withFullText(reference: Reference, fullText: FullText): Reference {
  return { ...reference, fullText, availability: "full_text", openAccess: true };
}

/**
 * What a reader must be told about a quotation drawn from this reference.
 *
 * Separate from `leadingCaveat` because it answers a different question. That
 * one is about whether to cite the work at all; this is about whether the words
 * you are looking at are the words in the version of record.
 */
export function quotationCaveat(reference: Reference): string | null {
  if (!reference.fullText) {
    return "Full text not openly available — the reference is listed, no passage can be shown";
  }
  switch (reference.fullText.version) {
    case "published":
      return null;
    case "accepted":
      return "Accepted manuscript — wording and pagination may differ from the published version";
    case "submitted":
      return "Submitted manuscript — this text has not been through peer review";
    case "unknown":
      return "Version of this copy is unrecorded — check the quotation against the published record";
  }
}
