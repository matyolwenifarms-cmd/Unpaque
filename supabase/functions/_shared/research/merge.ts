import type { Reference } from "./reference.ts";

// Two providers, one result set.
//
// OpenAlex and Crossref both know about most published work and each knows
// something the other does not. Crossref is the registration agency: its
// metadata is the record, and it is the only one of the two whose retraction
// flag settles anything. OpenAlex is an aggregator with far better coverage of
// open-access status, citation counts and grey literature.
//
// So the answer is not "pick a winner". It is to merge field by field, taking
// each fact from whichever source has standing for that particular fact, and
// to keep both names attached so the provenance is inspectable rather than
// implied.

export interface MergedReference extends Reference {
  /** Every provider that contributed, in the order they were merged. */
  sources: string[];
}

function asMerged(reference: Reference): MergedReference {
  return { ...reference, sources: [reference.source] };
}

/**
 * Merge two records of the same work.
 *
 * Order-independent by construction: every rule below picks on a property of
 * the values rather than on which argument they arrived in. That matters
 * because the merge order follows whatever order the providers happened to
 * answer in, and a result that changed with network timing would be a
 * genuinely horrible bug to chase.
 */
export function mergeReference(a: MergedReference, b: MergedReference): MergedReference {
  const authoritative = (reference: MergedReference) => reference.source === "crossref";
  const record = authoritative(a) ? a : authoritative(b) ? b : a;
  const other = record === a ? b : a;

  return {
    ...record,
    // Sorted, not concatenated. The only thing an arrival order tells you is
    // which provider answered faster, and letting that leak into the output
    // makes the merge non-deterministic for no benefit at all.
    sources: [...new Set([...a.sources, ...b.sources])].sort(),

    // The registration agency's title and venue are the record. Falling back
    // when it has none rather than preferring an empty authoritative field.
    title: record.title || other.title,
    venue: record.venue ?? other.venue,
    year: record.year ?? other.year,

    doi: a.doi ?? b.doi,
    providerId: record.providerId ?? other.providerId,

    // Longer author list wins. Both sources truncate, neither invents, so more
    // names is strictly more information rather than a disagreement. A tie
    // goes to the registration agency rather than to whichever replied first.
    authors: a.authors.length === b.authors.length
      ? record.authors
      : a.authors.length > b.authors.length
        ? a.authors
        : b.authors,

    // Crossref does not report open access at all, so whichever record has a
    // full text has it — this is not a conflict, it is one source knowing
    // something the other never claimed to.
    fullText: a.fullText ?? b.fullText,
    availability: a.fullText || b.fullText ? "full_text" : "metadata_only",
    openAccess: a.openAccess || b.openAccess,

    // Retraction takes the stronger claim, and `confirmed` can only have come
    // from an agency in the first place — so this cannot launder an
    // aggregator's flag into a confirmation.
    retraction: a.retraction === "confirmed" || b.retraction === "confirmed"
      ? "confirmed"
      : a.retraction === "contested" || b.retraction === "contested"
        ? "contested"
        : "none",

    // Either source calling it a preprint is enough. Erring toward labelling,
    // for the same reason the adapters do.
    preprint: a.preprint || b.preprint,

    // Both counts undercount and neither overcounts — Crossref sees only
    // deposited references, OpenAlex sees more but not everything. The larger
    // number is therefore the better lower bound, not a disagreement to split.
    citedByCount: Math.max(a.citedByCount ?? 0, b.citedByCount ?? 0) || undefined,

    verification: a.verification === "verified" || b.verification === "verified"
      ? "verified"
      : record.verification,

    landingPageUrl: record.landingPageUrl ?? other.landingPageUrl,
  };
}

/**
 * Collapse results from several providers into one list.
 *
 * Matched on DOI only. Title matching is the obvious next idea and is a trap:
 * conference papers and their extended journal versions share a title and are
 * different works, and merging them silently attributes one's findings to the
 * other's page numbers.
 */
export function mergeAll(...groups: Reference[][]): MergedReference[] {
  const byDoi = new Map<string, MergedReference>();
  const withoutDoi: MergedReference[] = [];

  for (const group of groups) {
    for (const reference of group) {
      const merged = asMerged(reference);
      if (!reference.doi) {
        withoutDoi.push(merged);
        continue;
      }
      const existing = byDoi.get(reference.doi);
      byDoi.set(reference.doi, existing ? mergeReference(existing, merged) : merged);
    }
  }

  return [...byDoi.values(), ...withoutDoi];
}
