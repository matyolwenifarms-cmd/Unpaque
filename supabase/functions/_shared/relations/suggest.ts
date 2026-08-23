// Two papers that report different numbers for what looks like the same thing.
//
// This is the reason the comparison in `compare.ts` was worth pulling out of
// Detect. A reviewer holding forty papers cannot read every pair of them
// against every other, and the disagreement that matters is usually a figure:
// one paper says 40%, another says 52%, and both are describing the 2018
// cohort.
//
// **It suggests and it never records.** A `Suggestion` has no field a relation
// or a basis could be written into, so there is no path from "these two
// numbers differ" to a stored claim that one paper contradicts another. That
// is not caution about a weak detector; it is the difference between a figure
// disagreeing and a contradiction. Two papers can report 40% and 52% for the
// same population, both correctly, because they counted different things —
// and only a person reading both can say which it is.

import { numericDisagreements, type Disagreement } from "./compare.ts";

export interface CorpusPage {
  number: number;
  body: string;
}

export interface CorpusPaper {
  id: string;
  name: string;
  pages: readonly CorpusPage[];
}

export interface Suggestion {
  /** The paper the reviewer would be looking at first. Not "the source". */
  readonly a: { id: string; name: string; page: number; figure: string };
  readonly b: { id: string; name: string; page: number; figure: string };
  /** The words both figures sit in, so the reviewer can judge without opening either. */
  readonly context: string;
}

export interface SuggestOptions {
  /** Passed through to the comparison. See `DisagreementOptions`. */
  contextOverlap?: number;
  /** Stop after this many. A corpus of forty papers has 780 pairs. */
  limit?: number;
}

const DEFAULT_LIMIT = 40;

/**
 * Pages of two papers, compared page against page.
 *
 * Page-wise rather than whole-document, and that is what makes it usable: a
 * figure and the words around it are on one page, and comparing two 30-page
 * documents as single strings puts a number from page 2 next to a number from
 * page 27 and calls their contexts similar.
 */
function betweenPapers(
  a: CorpusPaper,
  b: CorpusPaper,
  overlap: number | undefined,
): Suggestion[] {
  // Same unit required, unlike Detect. See `DisagreementOptions`: a paper is
  // long and full of years, and a year sitting three words from a count
  // overlaps with it quite enough to be reported as a disagreement.
  const options = {
    requireSameUnit: true,
    ...(overlap === undefined ? {} : { contextOverlap: overlap }),
  };
  const found: Suggestion[] = [];
  const seen = new Set<string>();

  for (const left of a.pages) {
    for (const right of b.pages) {
      for (const pair of numericDisagreements(left.body, right.body, options)) {
        // One suggestion per pair of values across the two papers, not per
        // page pair. A figure repeated in a running header would otherwise
        // produce the same suggestion thirty times.
        const key = `${pair.left.value}:${pair.right.value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(describe(a, left, b, right, pair));
      }
    }
  }

  return found;
}

function describe(
  a: CorpusPaper,
  aPage: CorpusPage,
  b: CorpusPaper,
  bPage: CorpusPage,
  pair: Disagreement,
): Suggestion {
  return {
    a: { id: a.id, name: a.name, page: aPage.number, figure: pair.left.raw },
    b: { id: b.id, name: b.name, page: bPage.number, figure: pair.right.raw },
    context: pair.left.context,
  };
}

/**
 * Every figure in the corpus that disagrees with a figure elsewhere in it.
 *
 * Ordered by the order the papers were given, and by nothing else. There is
 * deliberately no notion of a more serious disagreement: the only thing that
 * could rank one is the size of the gap between the figures, and a large gap
 * between two numbers counting different things is not more interesting than
 * a small gap between two counting the same thing.
 */
export function suggestDisagreements(
  papers: readonly CorpusPaper[],
  options: SuggestOptions = {},
): Suggestion[] {
  const limit = Math.max(0, options.limit ?? DEFAULT_LIMIT);
  const found: Suggestion[] = [];

  for (let i = 0; i < papers.length && found.length < limit; i += 1) {
    for (let j = i + 1; j < papers.length && found.length < limit; j += 1) {
      for (const suggestion of betweenPapers(papers[i]!, papers[j]!, options.contextOverlap)) {
        if (found.length >= limit) break;
        found.push(suggestion);
      }
    }
  }

  return found;
}

/** What to say above the list, including when there is nothing in it. */
export function suggestionSummary(
  suggestions: readonly Suggestion[],
  papers: number,
): string {
  if (papers < 2) {
    return "Two papers are needed before anything can be compared.";
  }
  if (suggestions.length === 0) {
    return `No figure in these ${papers} papers disagrees with a figure elsewhere in them. That is a statement about numbers in matching wording, and nothing more: two papers can disagree about everything and still not appear here.`;
  }
  return `${suggestions.length} ${suggestions.length === 1 ? "figure disagrees" : "figures disagree"} with a figure elsewhere in these ${papers} papers. A disagreeing figure is not a contradiction — two papers counting different things report different numbers, correctly — so each of these is a question for you rather than a finding.`;
}
