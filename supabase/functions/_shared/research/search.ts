import { mergeAll, type MergedReference } from "./merge.ts";
import type { Fetcher, SearchProvider, SearchQuery } from "./providers/types.ts";
import { byRecencyThenInfluence } from "./reference.ts";
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

export interface LiteratureRequest {
  text: string;
  fromYear?: number;
  perPage?: number;
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

  const query: SearchQuery = {
    text,
    perPage: request.perPage,
    ...(request.fromYear === undefined ? {} : { fromYear: request.fromYear }),
  };
  const notes: string[] = [];

  // Providers are queried together and independently. One being down must
  // degrade the result rather than fail it — a partial literature list with a
  // note saying so is far more useful than an error page.
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
    groups.push(outcome.references);
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
    return { references: merged.sort(byRecencyThenInfluence), reportedTotal, notes };
  }

  const verified = await verifyReferences(merged, deps.resolve, { concurrency: deps.concurrency });
  notes.push(verificationSummary(verified));
  if (verified.unchecked.length > 0) {
    notes.push(
      `${verified.unchecked.length} could not be checked — no DOI, or the agency was unreachable. They are still listed.`,
    );
  }

  const kept = verified.kept as MergedReference[];
  return { references: kept.sort(byRecencyThenInfluence), reportedTotal, notes };
}
