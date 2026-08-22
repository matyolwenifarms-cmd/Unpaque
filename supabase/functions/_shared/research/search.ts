import { mergeAll, type MergedReference } from "./merge.ts";
import type { Fetcher, SearchProvider, SearchQuery } from "./providers/types.ts";
import { byRecencyThenInfluence, byRelevance } from "./reference.ts";
import { queryTermsFrom } from "./terms.ts";
import { verificationSummary, verifyReferences, type Resolver } from "./verify.ts";

// The whole literature pipeline, and the part of The Researcher that needs no
// model at all: query, provider fan-out, merge, verify, rank. Every step is
// deterministic, and every provider it uses is free.
//
// The design principle throughout is that a researcher is told what happened.
// A search that quietly returned fewer results because a provider was down,
// or that skipped verification because the registration agency timed out, has
// produced something that looks identical to a smaller literature — and they
// would have no way to know.

/**
 * How the finished list is ordered.
 *
 * `relevance` is the default and the only ordering that answers the question.
 * `recency` is offered because a researcher genuinely does sometimes want to
 * see what is newest — but only over a set relevance has already chosen. It
 * was once applied to the whole merged result and the effect was to replace
 * the literature rather than order it; see `byRecencyThenInfluence`.
 */
export type ResultOrder = "relevance" | "recency";

export interface LiteratureRequest {
  text: string;
  fromYear?: number;
  perPage?: number;
  order?: ResultOrder;
}

export interface LiteratureResult {
  references: MergedReference[];
  /** The largest total any provider reported, as a rough sense of the field. */
  reportedTotal: number;
  /**
   * Everything that happened which changes how the list should be read.
   * Shown to the researcher, not logged and forgotten.
   */
  notes: string[];
}

export interface LiteratureDeps {
  providers: SearchProvider[];
  fetcher: Fetcher;
  /** Absent means verification is skipped, and the notes will say so. */
  resolve?: Resolver;
  concurrency?: number;
}

export async function searchLiterature(
  request: LiteratureRequest,
  deps: LiteratureDeps,
): Promise<LiteratureResult> {
  const text = request.text.trim();
  if (text === "") {
    return { references: [], reportedTotal: 0, notes: ["No search terms were given."] };
  }

  const notes: string[] = [];

  // A pasted proposal is not a query. Reduced before it is sent, and said out
  // loud: a search that quietly looked for something else and came back thin
  // has misrepresented the field to the person reading it.
  const terms = queryTermsFrom(text);
  if (terms.reduced) {
    notes.push(`Searched for the terms in what you pasted: ${terms.terms.join(", ")}.`);
  }

  const query: SearchQuery = {
    text: terms.query,
    perPage: request.perPage,
    ...(request.fromYear === undefined ? {} : { fromYear: request.fromYear }),
  };

  // Providers are queried together and independently. One being down must
  // degrade the result rather than fail it — a partial literature list with a
  // note saying so is far more useful than an error page.
  const secondaryFor = new Set(
    deps.providers.filter((provider) => provider.discovery === "secondary").map((p) => p.name),
  );

  const outcomes = await Promise.all(
    deps.providers.map(async (provider) => ({
      name: provider.name,
      outcome: await provider.search(query, deps.fetcher),
    })),
  );

  const groups = [];
  let reportedTotal = 0;
  for (const { name, outcome } of outcomes) {
    if (!outcome.ok) {
      notes.push(`${name} could not be reached (${outcome.status}), so its results are missing.`);
      continue;
    }
    // A secondary provider's position is discarded rather than merged. See
    // DiscoveryTier: its ordering is a metadata match, not a subject ranking,
    // and carrying it would let it decide the list twice over — once for the
    // works only it found, and again through the merge, where the better of two
    // ranks wins and "better" would mean the agency that ranked a trial
    // registration first. What survives is coverage, which is why it is still
    // queried: an unranked reference sorts below every ranked one and is still
    // listed. This is one line rather than a rule inside merge.ts on purpose —
    // merge should not have to know which provider it is holding.
    groups.push(
      secondaryFor.has(name)
        ? outcome.references.map((reference) => ({ ...reference, providerRank: undefined }))
        : outcome.references,
    );
    reportedTotal = Math.max(reportedTotal, outcome.total);
    if (outcome.dropped.length > 0) {
      notes.push(
        `${name} returned ${outcome.dropped.length} record(s) with no usable identifier; they are not listed.`,
      );
    }
  }

  if (groups.length === 0) {
    notes.push("No provider answered, so nothing can be shown. This is not an empty literature.");
    return { references: [], reportedTotal: 0, notes };
  }

  const merged = mergeAll(...groups);
  const overlapped = merged.filter((reference) => reference.sources.length > 1).length;
  if (overlapped > 0) {
    notes.push(`${overlapped} work(s) were found by more than one provider and have been combined.`);
  }

  if (!deps.resolve) {
    // Said plainly rather than left to inference. Unverified references are
    // exactly the ones a researcher needs to treat with suspicion.
    notes.push("Identifiers were not re-checked against the registration agency in this search.");
    return { references: order(merged, request.order, notes), reportedTotal, notes };
  }

  const verified = await verifyReferences(merged, deps.resolve, { concurrency: deps.concurrency });
  notes.push(verificationSummary(verified));
  if (verified.unchecked.length > 0) {
    notes.push(
      `${verified.unchecked.length} could not be checked — no DOI, or the agency was unreachable. They are still listed.`,
    );
  }

  const kept = verified.kept as MergedReference[];
  return { references: order(kept, request.order, notes), reportedTotal, notes };
}

/**
 * Order the finished list, and say so when the ordering is not relevance.
 *
 * The note is the point. Sorted by date, a list of references looks exactly
 * like a list ranked by how well it answers the question — same layout, same
 * badges — and a researcher who does not know which they are looking at cannot
 * tell a thin field from a bad sort. That confusion is what this whole change
 * came out of.
 */
function order(
  references: MergedReference[],
  requested: ResultOrder | undefined,
  notes: string[],
): MergedReference[] {
  if (requested === "recency") {
    notes.push("Ordered newest first, not by how well each one matches your question.");
    return [...references].sort(byRecencyThenInfluence);
  }
  return [...references].sort(byRelevance);
}
