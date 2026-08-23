// PRISMA screening, where the numbers cannot fail to add up.
//
// A PRISMA flow diagram is six numbers and three subtractions: how many records
// were found, how many were duplicates, how many titles were screened, how many
// were excluded and why, how many full texts were assessed, how many made it in.
// Every published one is drawn by hand, and a flow whose numbers do not
// reconcile is among the most common corrections a reviewer sends back.
//
// **So none of them is a number anybody types.** A record carries what happened
// to it and the counts are derived. The state where the diagram disagrees with
// the reviewer's own decisions is not representable, because there is nowhere
// to put a count that could disagree.
//
// Rejected: storing the totals and validating them. Validation is a check that
// runs after the mistake, tells somebody they have one, and leaves them to work
// out which of six numbers is wrong. Deriving is the version where the question
// never arises.

/**
 * What happened to one record, in the order it can happen.
 *
 * A record moves through these and stops. Every exclusion after screening has
 * to say why: PRISMA 2020 requires reasons for full-text exclusions and does
 * not require them for title screening, which is exactly the distinction the
 * two exclusion states make.
 */
export const SCREENING_STATES = [
  "identified",
  "duplicate",
  "excluded_on_title",
  "assessed",
  "excluded_on_full_text",
  "included",
] as const;
export type ScreeningState = (typeof SCREENING_STATES)[number];

export interface ScreenedRecord {
  readonly id: string;
  /** What the reviewer is looking at: a title, usually with its authors. */
  readonly label: string;
  readonly state: ScreeningState;
  /**
   * Why it was excluded. Required by PRISMA for a full-text exclusion, and
   * checked by `problems()` rather than by the type, because a record arrives
   * from a database row and a type cannot refuse what is already stored.
   */
  readonly reason?: string;
  /** Where it came from: a provider, a hand search, a reference list. */
  readonly from?: string;
}

export interface FlowCounts {
  readonly identified: number;
  readonly duplicatesRemoved: number;
  readonly screened: number;
  readonly excludedOnTitle: number;
  readonly assessed: number;
  readonly excludedOnFullText: number;
  readonly included: number;
  /** Full-text exclusions grouped by reason, largest first. Required by PRISMA. */
  readonly reasons: readonly { reason: string; count: number }[];
}

/**
 * A diagram, or the reason there is not one yet.
 *
 * A union, and this is the second half of the guarantee. The first half is that
 * no count is typed in. The second is that **an unfinished review cannot
 * produce a diagram at all**, because PRISMA has no box for a record nobody has
 * decided about: with thirty titles unscreened, screened minus excluded-on-title
 * does not equal assessed, and any picture drawn from those numbers is one a
 * reviewer would have to explain.
 *
 * The first version of this returned counts either way and let the subtraction
 * fail quietly partway through a review. Splitting it means the counts do not
 * exist until every record has been decided — so there is nothing to render
 * early, and nothing to misread.
 */
export type Flow =
  | { readonly kind: "complete"; readonly counts: FlowCounts }
  | {
      readonly kind: "in_progress";
      readonly atTitle: number;
      readonly atFullText: number;
      readonly decidedSoFar: number;
      readonly says: string;
    };

/**
 * The flow, counted from the records, or the reason there is not one yet.
 *
 * Note what is not in the signature: any way to pass a number in.
 */
export function flowOf(records: readonly ScreenedRecord[]): Flow {
  const count = (state: ScreeningState) =>
    records.filter((record) => record.state === state).length;

  const atTitle = count("identified");
  const atFullText = count("assessed");
  if (atTitle > 0 || atFullText > 0) {
    const parts: string[] = [];
    if (atTitle > 0) parts.push(`${atTitle} not yet screened`);
    if (atFullText > 0) parts.push(`${atFullText} read but not yet decided`);
    return {
      kind: "in_progress",
      atTitle,
      atFullText,
      decidedSoFar: records.length - atTitle - atFullText,
      says: `${parts.join(" and ")}. A PRISMA diagram has no box for a record nobody has decided about, so there is no diagram until there are none: the numbers would not subtract, and an examiner would ask why.`,
    };
  }

  // Past the guard, `atTitle` and `atFullText` are both nought, so nothing
  // below needs an allowance for an undecided record. That is worth saying
  // because it looks like an omission: a control that folded `atFullText` into
  // `assessed` here changed no result at all, which is the union doing its job
  // rather than a test failing to notice.
  const duplicatesRemoved = count("duplicate");
  const excludedOnTitle = count("excluded_on_title");
  const excludedOnFullText = count("excluded_on_full_text");
  const included = count("included");

  const assessed = excludedOnFullText + included;
  const screened = assessed + excludedOnTitle;
  const identified = screened + duplicatesRemoved;

  const byReason = new Map<string, number>();
  for (const record of records) {
    if (record.state !== "excluded_on_full_text") continue;
    const reason = record.reason?.trim() || "No reason given";
    byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  }

  return {
    kind: "complete",
    counts: {
      identified,
      duplicatesRemoved,
      screened,
      excludedOnTitle,
      assessed,
      excludedOnFullText,
      included,
      reasons: [...byReason.entries()]
        .map(([reason, howMany]) => ({ reason, count: howMany }))
        .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    },
  };
}

/** How many records are still waiting on a decision, by stage. */
export function outstanding(records: readonly ScreenedRecord[]): {
  atTitle: number;
  atFullText: number;
} {
  return {
    atTitle: records.filter((record) => record.state === "identified").length,
    atFullText: records.filter((record) => record.state === "assessed").length,
  };
}

/**
 * What is wrong with the screening as it stands, in sentences.
 *
 * Not validation of the arithmetic — that cannot be wrong. These are the
 * things PRISMA requires that a set of decisions can still be missing.
 */
export function problems(records: readonly ScreenedRecord[]): string[] {
  const found: string[] = [];

  const unexplained = records.filter(
    (record) => record.state === "excluded_on_full_text" && !record.reason?.trim(),
  );
  if (unexplained.length > 0) {
    found.push(
      `${unexplained.length} full ${unexplained.length === 1 ? "text was" : "texts were"} excluded with no reason given. PRISMA 2020 asks for a reason against each one, and a diagram reading "excluded (n = 14)" with nothing beside it is the box reviewers ask about first.`,
    );
  }

  if (records.length > 0 && records.every((record) => record.state === "identified")) {
    found.push("Nothing has been screened yet, so every record is still in the first box.");
  }

  return found;
}

/**
 * The flow as the sentences a methods section needs.
 *
 * Takes the counts, which only exist for a finished review, so there is no way
 * to write these lines about one still in progress. Written out rather than
 * left as a diagram because the numbers have to appear in the prose too, and
 * transcribing them by hand from a picture is where the two come apart.
 */
export function readFlow(counts: FlowCounts): string[] {
  const lines = [
    `${counts.identified} record${counts.identified === 1 ? "" : "s"} identified.`,
    counts.duplicatesRemoved === 0
      ? "No duplicates were removed."
      : `${counts.duplicatesRemoved} duplicate${counts.duplicatesRemoved === 1 ? "" : "s"} removed, leaving ${counts.screened} to screen.`,
    `${counts.excludedOnTitle} excluded on title and abstract.`,
    `${counts.assessed} full text${counts.assessed === 1 ? "" : "s"} assessed for eligibility.`,
    `${counts.excludedOnFullText} excluded at full text.`,
    `${counts.included} included in the review.`,
  ];

  for (const { reason, count } of counts.reasons) {
    lines.push(`  Excluded at full text — ${reason}: ${count}.`);
  }

  return lines;
}
