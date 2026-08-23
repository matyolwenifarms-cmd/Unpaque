// The supervisor pass: everything that can be said about a proposal without a
// model, said in the order a supervisor would say it.
//
// A student who has never used this product does not know that there is a
// codebook screen, a coherence checker and a literature pipeline in here, and
// asking them to find each one is asking them to already know the answer. So
// they hand over the proposal, and this runs the four checks that need nothing
// from them:
//
//   1. the design it declares, and whether the declarations pull against each
//      other (§6)
//   2. the reference-list arithmetic — cited and not listed, listed and
//      never cited
//   3. every DOI, resolved at its registration agency
//   4. work in the same field that the proposal does not cite
//
// **What it does not do is rewrite anything.** Suggesting a better sentence is
// a judgement about argument, and there is no honest deterministic version of
// it: a tool that reworded a passage by rule would be handing back prose it
// cannot defend, over a student's name, to an examiner. That stays absent
// until a model does it, and the interface says so rather than leaving a gap
// the student reads as approval.
//
// The second refusal is smaller and matters as much. Nothing here calls a
// suggested reference *better* than one the proposal already cites. The
// providers rank by their own scoring of a bag of words; that is a good way to
// find what a search missed and no way at all to judge fit. The sentence a
// student reads says which it is.

import type { Tension } from "../method/coherence.ts";
import { checkCoherence } from "../method/coherence.ts";
import type { LiteratureRequest, LiteratureResult } from "../search.ts";
import { leadingCaveat, type Reference } from "../reference.ts";
import { queryTermsFrom } from "../terms.ts";
import type { Resolver } from "../verify.ts";
import { proseOf, readProposal, readingNotes, type ProposalReading } from "./citations.ts";
import { designFrom, designNotes, readDesign, type DesignReading } from "./design.ts";

/**
 * What became of one identifier.
 *
 * Four states, and no boolean anywhere, because the difference between "the
 * agency says there is no such record" and "the agency could not be reached"
 * is the difference between a serious finding and no finding at all. A single
 * `verified: false` collapses them, and the sentence that gets written from it
 * accuses a student of citing something that does not exist because a network
 * call timed out.
 */
export type DoiCheck =
  | {
      readonly doi: string;
      readonly kind: "resolved";
      /** What the agency has under it, where it returned one. */
      readonly title: string | null;
      readonly retracted: boolean;
    }
  | { readonly doi: string; readonly kind: "absent" }
  | { readonly doi: string; readonly kind: "malformed" }
  | { readonly doi: string; readonly kind: "unchecked"; readonly because: string };

/**
 * The coherence check, or the reason it did not run.
 *
 * A union rather than a list and a flag: an empty list of tensions means the
 * design was checked and hangs together, and that is a real and reassuring
 * result. It must not be reachable from "nothing was checked".
 */
export type Coherence =
  | { readonly kind: "checked"; readonly tensions: readonly Tension[] }
  | { readonly kind: "not_checked"; readonly because: string };

export interface Suggestion {
  readonly reference: Reference;
  /**
   * Why it is in the list, in a sentence. Never "this is more relevant" —
   * see the header. It says what the search did and leaves the judgement.
   */
  readonly because: string;
}

export type RelatedWork =
  | {
      readonly kind: "searched";
      readonly suggestions: readonly Suggestion[];
      /** The terms actually sent, which are not the words the student wrote. */
      readonly searchedFor: readonly string[];
    }
  | { readonly kind: "not_searched"; readonly because: string };

export interface Supervision {
  readonly citations: ProposalReading;
  readonly design: DesignReading;
  readonly coherence: Coherence;
  readonly checks: readonly DoiCheck[];
  /** How many DOIs there were, when more were found than were checked. */
  readonly doiTotal: number;
  readonly related: RelatedWork;
}

export interface SuperviseDeps {
  /** Checks the DOIs at their registration agency. Absent means none are checked. */
  readonly check?: Checker;
  /** Finds related work. Absent means none is suggested. */
  readonly search?: (request: LiteratureRequest) => Promise<LiteratureResult>;
  /**
   * How many identifiers to resolve. A thesis carries ninety, every one of
   * them a request to a free public service run for everybody.
   */
  readonly maxChecks?: number;
  readonly maxSuggestions?: number;
}

const DEFAULT_MAX_CHECKS = 30;
const DEFAULT_MAX_SUGGESTIONS = 8;
const RESOLVE_CONCURRENCY = 4;

/** Checks a whole list at once. See `SuperviseDeps.check`. */
export type Checker = (dois: readonly string[]) => Promise<readonly DoiCheck[]>;

/**
 * A checker built from a one-at-a-time resolver.
 *
 * The seam is the list rather than the identifier because of where the two
 * callers sit. A browser has to reach the registration agency through this
 * product's own endpoint — it is rate-limited per request, and one request
 * per DOI would spend a student's whole hourly allowance on a single
 * proposal. A server, and a test, has a resolver already. So the dependency
 * takes the list, and this turns a resolver into one.
 */
export function checksFrom(resolve: Resolver): Checker {
  return (dois) => checkEach(dois, resolve);
}

async function checkEach(dois: readonly string[], resolve: Resolver): Promise<DoiCheck[]> {
  const checks: DoiCheck[] = [];

  for (let start = 0; start < dois.length; start += RESOLVE_CONCURRENCY) {
    const batch = dois.slice(start, start + RESOLVE_CONCURRENCY);
    const outcomes = await Promise.all(
      batch.map(async (doi): Promise<DoiCheck> => {
        try {
          const outcome = await resolve(doi);
          if (outcome.state === "found") {
            return {
              doi,
              kind: "resolved",
              title: outcome.record?.title ?? null,
              retracted: outcome.retracted,
            };
          }
          if (outcome.state === "not_found") return { doi, kind: "absent" };
          if (outcome.state === "malformed") return { doi, kind: "malformed" };
          return { doi, kind: "unchecked", because: "the registration agency could not be reached" };
        } catch {
          // A thrown resolver is the same situation as an unreachable one, and
          // must not be allowed to become an accusation.
          return { doi, kind: "unchecked", because: "the lookup failed" };
        }
      }),
    );
    checks.push(...outcomes);
  }

  return checks;
}

/** Surname and year, in the form both sides of the comparison are keyed on. */
function keyOf(surname: string, year: number | undefined): string | null {
  if (year === undefined) return null;
  return `${surname.toLowerCase().replace(/\s+/g, " ").trim()} ${year}`;
}

/**
 * Work in the field that the proposal does not already cite.
 *
 * The filter is the whole value of this. A list of suggestions in which four
 * of eight are already in the student's reference list teaches them, in about
 * fifteen seconds, that the tool has not read their work.
 */
function suggestFrom(
  reading: ProposalReading,
  found: readonly Reference[],
  limit: number,
): Suggestion[] {
  const known = new Set<string>();
  for (const doi of reading.dois) known.add(doi);
  for (const entry of reading.listed) {
    if (entry.surname === null) continue;
    const key = keyOf(entry.surname, entry.year ?? undefined);
    if (key !== null) known.add(key);
  }
  for (const citation of reading.inText) {
    const key = keyOf(citation.author, citation.year);
    if (key !== null) known.add(key);
  }

  const suggestions: Suggestion[] = [];
  for (const reference of found) {
    if (suggestions.length >= limit) break;
    if (reference.doi !== undefined && known.has(reference.doi)) continue;

    const first = reference.authors[0]?.name;
    const surname = first === undefined ? null : first.split(/\s+/).pop() ?? null;
    const key = surname === null ? null : keyOf(surname, reference.year);
    if (key !== null && known.has(key)) continue;

    const parts: string[] = ["Not in your reference list."];
    if (reference.citedByCount !== undefined && reference.citedByCount > 0) {
      parts.push(`Cited ${reference.citedByCount} times.`);
    }
    if (reference.fullText !== undefined) parts.push("An open copy is available.");
    // The caveat is written as a label, without a stop, because it is also
    // shown on its own as a badge. In a sentence it needs one.
    const caveat = leadingCaveat(reference);
    if (caveat !== null) parts.push(`${caveat}.`);

    suggestions.push({ reference, because: parts.join(" ") });
  }

  return suggestions;
}

/** Everything that can be checked about a proposal without asking a model. */
export async function superviseProposal(
  text: string,
  deps: SuperviseDeps = {},
): Promise<Supervision> {
  const citations = readProposal(text);
  const design = readDesign(text);

  const forCoherence = designFrom(design);
  const coherence: Coherence = forCoherence === null
    ? {
        kind: "not_checked",
        because: design.paradigm === null
          ? "the proposal does not say which paradigm the study works in"
          : "the paradigm appears in the proposal, but not in a sentence about this study",
      }
    : { kind: "checked", tensions: checkCoherence(forCoherence) };

  const maxChecks = Math.max(0, deps.maxChecks ?? DEFAULT_MAX_CHECKS);
  let checks: readonly DoiCheck[] = [];
  if (deps.check && citations.dois.length > 0) {
    const asked = citations.dois.slice(0, maxChecks);
    try {
      checks = await deps.check(asked);
    } catch {
      // Same rule as a thrown resolver: an unreachable service must never
      // become a sentence about a student's references.
      checks = asked.map((doi) => ({ doi, kind: "unchecked", because: "the lookup failed" }));
    }
  }

  let related: RelatedWork = {
    kind: "not_searched",
    because: "no literature search was available",
  };
  if (deps.search) {
    try {
      // The prose, not the document. See `proseOf`: searching on a proposal
      // with its bibliography still attached returns the bibliography back.
      const prose = proseOf(text);
      const result = await deps.search({ text: prose });
      related = {
        kind: "searched",
        suggestions: suggestFrom(
          citations,
          result.references,
          Math.max(0, deps.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS),
        ),
        searchedFor: queryTermsFrom(prose).terms,
      };
    } catch {
      related = { kind: "not_searched", because: "the literature search could not be reached" };
    }
  }

  return { citations, design, coherence, checks, doiTotal: citations.dois.length, related };
}

/** "One DOI", "3 DOIs" — never a bare number in front of a verb. */
function countOf(n: number, noun: string): string {
  return n === 1 ? `One ${noun}` : `${n} ${noun}s`;
}

function checkNotes(supervision: Supervision): string[] {
  const { checks, doiTotal } = supervision;
  if (checks.length === 0) return [];

  const notes: string[] = [];
  const absent = checks.filter((check) => check.kind === "absent" || check.kind === "malformed");
  const retracted = checks.filter((check) => check.kind === "resolved" && check.retracted);
  const unchecked = checks.filter((check) => check.kind === "unchecked");
  const resolved = checks.length - absent.length - unchecked.length;

  // Nothing came back at all. Reporting scope first — "the one DOI was
  // checked: 0 resolved" — is the accusation this module is built to
  // prevent, arriving through the sentence that was supposed to be neutral.
  // A reader stops at "0 resolved"; the correction underneath it is too late.
  if (unchecked.length === checks.length) {
    return [
      `${countOf(checks.length, "DOI")} could not be checked, because ${unchecked[0]!.kind === "unchecked" ? unchecked[0]!.because : "the lookup failed"}. Nothing follows from that about whether ${checks.length === 1 ? "it exists" : "they exist"}.`,
    ];
  }

  const all = checks.length === 1
    ? "The one DOI in the proposal was checked"
    : checks.length === 2
      ? "Both DOIs in the proposal were checked"
      : `All ${checks.length} DOIs in the proposal were checked`;
  const capped = checks.length === 1
    ? `The first of the ${doiTotal} DOIs in the proposal was checked`
    : `The first ${checks.length} of the ${doiTotal} DOIs in the proposal were checked`;
  const scope = doiTotal > checks.length ? capped : all;
  notes.push(`${scope}: ${resolved} resolved at the registration agency.`);

  if (retracted.length > 0) {
    notes.push(
      `${retracted.length === 1 ? "One reference is" : `${retracted.length} references are`} registered as retracted — ${retracted.map((check) => check.doi).join(", ")} — and a retracted work can still be cited, but it has to be cited as retracted.`,
    );
  }

  if (absent.length > 0) {
    notes.push(
      `${absent.length === 1 ? "One DOI did" : `${absent.length} DOIs did`} not resolve — ${absent.map((check) => check.doi).join(", ")} — which is usually a typing slip in the identifier. It is worth checking, because an examiner who follows a DOI that goes nowhere has no way to tell a slip from an invention.`,
    );
  }

  if (unchecked.length > 0) {
    notes.push(
      `${countOf(unchecked.length, "DOI")} could not be checked, because ${unchecked[0]!.kind === "unchecked" ? unchecked[0]!.because : "the lookup failed"}. Nothing follows from that about whether ${unchecked.length === 1 ? "it exists" : "they exist"}.`,
    );
  }

  return notes;
}

function relatedNotes(supervision: Supervision): string[] {
  const { related } = supervision;
  // Said out loud rather than left as an absence. A student who sees no
  // suggestions cannot tell "your field is well covered in your list" from
  // "the search never ran", and the two call for opposite next steps.
  if (related.kind === "not_searched") {
    return [`No related work was looked for, because ${related.because}.`];
  }
  if (related.suggestions.length === 0) {
    return [
      "The literature search found nothing your reference list does not already have. That is a good sign about the list, and a weak one about the search: it matches words in titles and abstracts, and it does not read.",
    ];
  }

  return [
    `${related.suggestions.length} ${related.suggestions.length === 1 ? "work" : "works"} came back for the terms in your proposal and ${related.suggestions.length === 1 ? "is" : "are"} not in your reference list${related.searchedFor.length > 0 ? `. The terms searched for were: ${related.searchedFor.join(", ")}` : ""}. They are ordered by the providers' own relevance scoring of titles and abstracts, which is a way of finding what a search missed and not a judgement about whether any of them belongs in your study.`,
  ];
}

/**
 * The whole report, in the order a supervisor gives it.
 *
 * Design first, because a design that pulls apart is worth more of a
 * student's afternoon than a missing reference, and a report that opens with
 * three lines of reference arithmetic teaches them this is a formatting tool.
 */
export function superviseNotes(supervision: Supervision): string[] {
  const notes = [...designNotes(supervision.design)];

  if (supervision.coherence.kind === "checked") {
    for (const tension of supervision.coherence.tensions) {
      // Not brackets: every source in the coherence module already ends in a
      // bracketed year, and nesting them reads as a typo. Not a dash either,
      // because `consider` ends in a full stop and a dash after one is wrong.
      notes.push(`${tension.says} ${tension.consider} See ${tension.source}.`);
    }
    if (supervision.coherence.tensions.length === 0) {
      notes.push("Nothing in the design as read pulls against anything else in it.");
    }
  } else {
    notes.push(
      `The coherence check did not run, because ${supervision.coherence.because}. One sentence naming it is what turns that on.`,
    );
  }

  notes.push(...readingNotes(supervision.citations));
  notes.push(...checkNotes(supervision));
  notes.push(...relatedNotes(supervision));

  return notes;
}
