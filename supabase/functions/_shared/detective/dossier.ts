// The document a case is for.
//
// Everything up to now has been entry: sources in, claims in, evidence linked,
// events placed. Nothing assembled them, which left Detect in the worst state
// a tool can be in — data goes in and nothing comes out.
//
// §4's three questions, in order, and the order is the argument:
//
//   1. What does the available evidence allow us to say?
//   2. What remains unknown?
//   3. What does not fit?
//
// The second is not a footnote to the first. An investigative document that
// leads with findings and buries the gaps has told the reader what to think
// before telling them what is missing, and the gaps are usually the part that
// decides whether the findings hold. So "what remains unknown" is a section
// with the same weight as the others, and it is never empty by construction:
// if nothing is unknown, that is itself a claim requiring justification, and
// the assembler says so rather than printing nothing.
//
// No model. Every sentence here is assembled from the record, and the record
// is what the investigator entered. Where the dossier says something is
// corroborated it is because two independent sources support it and none
// contradicts it — a fact about the rows, checkable by reading them.

import {
  EPISTEMIC_MEANINGS,
  independentSupport,
  mayBeCorroborated,
  type EpistemicStatus,
  type EvidenceClassification,
  type EvidenceLike,
} from "./epistemic.ts";
import {
  chronological,
  collectiveCertainty,
  findTemporalDiscrepancies,
  type Discrepancy,
  type TimelineEvent,
} from "./timeline.ts";

export interface DossierClaim {
  id: string;
  statement: string;
  status: EpistemicStatus;
  /** Who or what asserts it. Absent is legitimate — not every claim has one. */
  assertedBy?: string | null;
  evidence: Array<EvidenceLike & { sourceTitle: string; excerpt?: string | null }>;
}

export interface DossierSource {
  id: string;
  title: string;
  kind: string;
  retrievedFrom: string;
  contentHash?: string | null;
}

/**
 * An event as the case file holds it, which is not quite a `TimelineEvent`.
 *
 * Two differences, both load-bearing. The time may be absent — `certainty` of
 * `unknown` is a legitimate state and the column is nullable — so an event
 * cannot always become a TimelineEvent, and the ones that cannot are a finding
 * rather than a filtering problem. And it carries `moment`: the investigator's
 * own label for which happening this record is about.
 */
export interface DossierEvent {
  id: string;
  label: string;
  /** ISO 8601, or null where the time is not known. */
  at: string | null;
  certainty: TimelineEvent["certainty"];
  origin: TimelineEvent["origin"];
  sourceId: string;
  /** The investigator's label. Records sharing one are compared. */
  moment?: string | null;
  toleranceMinutes?: number;
}

export interface DossierInput {
  title: string;
  question?: string | null;
  claims: DossierClaim[];
  sources: DossierSource[];
  events: DossierEvent[];
  /** How far apart two records of one moment must be to count as a conflict. */
  thresholdMinutes?: number;
}

/** One line about a claim, and what the record actually licenses saying. */
export interface ClaimReading {
  claim: DossierClaim;
  supporting: number;
  contradicting: number;
  /** True where two independent sources support and none contradicts. */
  corroboratable: boolean;
  /** What the evidence licenses, in a sentence. Never a verdict. */
  reading: string;
  /** What would move it. Always present — see the module note. */
  wouldSettleIt: string;
}

export interface Dossier {
  title: string;
  question: string | null;
  /** §4 question 1. */
  established: ClaimReading[];
  /** Claims the evidence does not yet carry. */
  unsupported: ClaimReading[];
  /** §4 question 2. Never empty. */
  unknowns: string[];
  /** §4 question 3. */
  discrepancies: Discrepancy[];
  /** Sources that appear to be the same bytes twice. */
  duplicateSources: Array<{ hash: string; titles: string[] }>;
  events: TimelineEvent[];
  /** Events with no time recorded. They sit outside the sequence. */
  unplaced: DossierEvent[];
  /** How well the timeline is known overall. */
  timelineCertainty: ReturnType<typeof collectiveCertainty>;
}

/**
 * Read one claim's evidence, without deciding anything.
 *
 * The distinction the whole feature turns on: this says what the evidence
 * *permits*, never what is true. "Two independent sources support this and
 * none contradicts it" is a fact about the rows. "This is what happened" is
 * not, and no amount of evidence in a case file makes it one.
 */
export function readClaim(claim: DossierClaim): ClaimReading {
  const supporting = independentSupport(claim.evidence);
  const contradicting = claim.evidence.filter(
    (item) => item.classification === "contradicts",
  ).length;
  const undermined = claim.evidence.filter(
    (item) => item.classification === "undermines_source",
  ).length;
  const corroboratable = mayBeCorroborated(claim.evidence);

  let reading: string;
  let wouldSettleIt: string;

  if (claim.evidence.length === 0) {
    reading = "Nothing in the case file bears on this yet.";
    wouldSettleIt = "Any source that speaks to it, for or against.";
  } else if (contradicting > 0 && supporting > 0) {
    reading = `${describeCount(supporting, "independent source")} ${verb(supporting, "support")} this and ${describeCount(contradicting, "piece of evidence")} ${verb(contradicting, "contradict")} it. The record does not settle which is right.`;
    wouldSettleIt =
      "A source that is independent of both, or a reason to prefer one — a primary record against a report of it, or a documented error in the other.";
  } else if (contradicting > 0) {
    reading = `${describeCount(contradicting, "piece of evidence")} ${verb(contradicting, "contradict")} this and nothing in the file supports it.`;
    wouldSettleIt = "Whatever the claim rests on, if anything does.";
  } else if (corroboratable) {
    reading = `${describeCount(supporting, "independent source")} ${verb(supporting, "support")} this and none contradicts it.`;
    wouldSettleIt =
      "It is as well supported as this file makes it. A primary record would raise it further; an independent account that disagreed would lower it.";
  } else if (supporting === 1) {
    // The single most common overstatement in an investigative file: one
    // source, repeated confidently, becoming a finding.
    reading = "One source supports this. Nothing independent has confirmed it.";
    wouldSettleIt = "A second source that did not get it from the first.";
  } else {
    reading = `The evidence on this is ${describeClassifications(claim.evidence)} — none of it supports or contradicts the claim directly.`;
    wouldSettleIt = "A source that speaks to the claim itself rather than around it.";
  }

  if (undermined > 0) {
    reading += ` ${describeCount(undermined, "piece of evidence")} ${verb(undermined, "bear")} on the reliability of a source used here.`;
  }

  return { claim, supporting, contradicting, corroboratable, reading, wouldSettleIt };
}

/**
 * Assemble the case into a dossier.
 *
 * Pure: it reads the rows and returns a structure. Nothing is written back,
 * and in particular no claim's `status` is changed — promoting a claim to
 * corroborated because a count crossed two is exactly the collapse into truth
 * the epistemic model exists to prevent, and §4 keeps that decision with a
 * person.
 */
export function assembleDossier(input: DossierInput): Dossier {
  const readings = input.claims.map(readClaim);
  const placed = input.events.filter(isPlaced).map(toTimelineEvent);
  const unplaced = input.events.filter((event) => !isPlaced(event));

  return {
    title: input.title,
    question: input.question ?? null,
    established: readings.filter((reading) => reading.corroboratable),
    unsupported: readings.filter((reading) => !reading.corroboratable),
    unknowns: findUnknowns(input, readings),
    discrepancies: discrepanciesByMoment(input.events, input.thresholdMinutes),
    duplicateSources: findDuplicateSources(input.sources),
    events: chronological(placed),
    unplaced,
    timelineCertainty: collectiveCertainty(placed),
  };
}

function isPlaced(event: DossierEvent): boolean {
  return typeof event.at === "string" && event.at.trim() !== "";
}

function toTimelineEvent(event: DossierEvent): TimelineEvent {
  return {
    id: event.id,
    label: event.label,
    at: event.at!,
    certainty: event.certainty,
    origin: event.origin,
    sourceId: event.sourceId,
    ...(event.toleranceMinutes === undefined ? {} : { toleranceMinutes: event.toleranceMinutes }),
  };
}

/**
 * Discrepancies, per moment the investigator has labelled.
 *
 * `findTemporalDiscrepancies` takes events that are *asserted* to describe the
 * same happening and deliberately does not guess which those are. The `moment`
 * column is where the investigator says so, and this is the only thing that
 * reads it — grouping by it here rather than comparing every event with every
 * other is the difference between finding conflicts and manufacturing them.
 *
 * Events with no moment are not compared with anything. Two records that were
 * never claimed to be about the same thing cannot disagree.
 */
export function discrepanciesByMoment(
  events: readonly DossierEvent[],
  thresholdMinutes?: number,
): Discrepancy[] {
  const byMoment = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const moment = event.moment?.trim();
    if (!moment || !isPlaced(event)) continue;
    const group = byMoment.get(moment);
    if (group) group.push(toTimelineEvent(event));
    else byMoment.set(moment, [toTimelineEvent(event)]);
  }

  const options = thresholdMinutes === undefined ? {} : { thresholdMinutes };
  return [...byMoment.values()]
    .filter((group) => group.length > 1)
    .flatMap((group) => findTemporalDiscrepancies(group, options));
}

/**
 * What the file does not answer.
 *
 * Never returns an empty list. A case with no stated unknowns is not a
 * complete case; it is a case whose gaps have not been written down, and
 * printing nothing there would let a reader take the silence for completeness.
 */
export function findUnknowns(input: DossierInput, readings: ClaimReading[]): string[] {
  const unknowns: string[] = [];

  if (input.question?.trim()) {
    const answered = readings.some((reading) => reading.corroboratable);
    if (!answered) {
      unknowns.push(
        `The question this case asks — "${input.question.trim()}" — is not answered by anything in the file that two independent sources support.`,
      );
    }
  }

  const single = readings.filter((reading) => reading.supporting === 1 && reading.contradicting === 0);
  if (single.length > 0) {
    unknowns.push(
      `${describeCount(single.length, "claim")} rests on a single source: ${single.map((reading) => quote(reading.claim.statement)).join("; ")}. Whether that source is right is not established by the file.`,
    );
  }

  const bare = readings.filter((reading) => reading.claim.evidence.length === 0);
  if (bare.length > 0) {
    unknowns.push(
      `${describeCount(bare.length, "claim")} has no evidence attached at all: ${bare.map((reading) => quote(reading.claim.statement)).join("; ")}.`,
    );
  }

  const unattributed = input.claims.filter((claim) => !claim.assertedBy?.trim());
  if (unattributed.length > 0) {
    unknowns.push(
      `${describeCount(unattributed.length, "claim")} does not record who asserts it, so its standing cannot be weighed.`,
    );
  }

  const unplaced = input.events.filter((event) => !isPlaced(event));
  if (unplaced.length > 0) {
    unknowns.push(
      `${describeCount(unplaced.length, "event")} has no time recorded and sits outside the sequence.`,
    );
  }

  // An event nobody has assigned to a moment is compared with nothing, so a
  // conflict it is part of cannot be found. Silence there reads as agreement.
  const unlabelled = input.events.filter((event) => isPlaced(event) && !event.moment?.trim());
  if (unlabelled.length > 0) {
    unknowns.push(
      `${describeCount(unlabelled.length, "event")} is not assigned to a moment, so nothing was compared against it — any disagreement it is part of is undetected rather than absent.`,
    );
  }

  if (input.sources.length === 0) {
    unknowns.push("There are no sources in this file. Nothing here rests on anything.");
  }

  if (unknowns.length === 0) {
    // The honest floor. Reached only by a file with no gaps of the kinds this
    // function can see, which is not the same as a file with no gaps.
    unknowns.push(
      "Nothing in the file is flagged as unknown by the checks above. That is a statement about the checks, not about the investigation — what has not been looked for does not appear here.",
    );
  }

  return unknowns;
}

/**
 * Sources whose bytes are identical.
 *
 * A wire story printed in four papers is one source. `independentSupport`
 * already refuses to count it four times; this says so out loud, because an
 * investigator looking at four rows in a source list has no other way to know.
 */
export function findDuplicateSources(
  sources: readonly DossierSource[],
): Array<{ hash: string; titles: string[] }> {
  const byHash = new Map<string, string[]>();
  for (const source of sources) {
    if (!source.contentHash) continue;
    const titles = byHash.get(source.contentHash);
    if (titles) titles.push(source.title);
    else byHash.set(source.contentHash, [source.title]);
  }
  return [...byHash.entries()]
    .filter(([, titles]) => titles.length > 1)
    .map(([hash, titles]) => ({ hash, titles }));
}

function describeCount(count: number, noun: string): string {
  const plural = count === 1 ? noun : pluralise(noun);
  return `${count} ${plural}`;
}

/**
 * The verb to agree with a count.
 *
 * Its own function because the counts are interpolated and the verbs were not,
 * which produced "1 independent source support this" — a sentence that reads
 * as carelessness in a document whose whole claim is care about what the
 * record says.
 */
function verb(count: number, stem: string): string {
  return count === 1 ? `${stem}s` : stem;
}

/**
 * Pluralise the head of the phrase, which is not always its last word.
 *
 * "piece of evidence" became "piece of evidences" — the head is *piece*, and
 * an "of" phrase modifies it rather than replacing it. The same shape catches
 * "line of enquiry" and "point of fact". Everything else pluralises on the
 * last word, which is the ordinary case.
 */
function pluralise(noun: string): string {
  const of = noun.indexOf(" of ");
  if (of > 0) return `${pluralise(noun.slice(0, of))}${noun.slice(of)}`;
  if (noun.endsWith("y") && !/[aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  if (noun.endsWith("s") || noun.endsWith("ch") || noun.endsWith("sh") || noun.endsWith("x")) {
    return `${noun}es`;
  }
  return `${noun}s`;
}

function describeClassifications(evidence: readonly { classification: EvidenceClassification }[]): string {
  const kinds = [...new Set(evidence.map((item) => item.classification.replace(/_/g, " ")))];
  if (kinds.length === 1) return kinds[0]!;
  if (kinds.length === 2) return `${kinds[0]} and ${kinds[1]}`;
  return `${kinds.slice(0, -1).join(", ")}, and ${kinds[kinds.length - 1]}`;
}

/**
 * A statement in quotation marks, with its own full stop removed.
 *
 * The quoted text is a sentence and the sentence quoting it needs its own
 * terminator, so leaving both produces `"The vehicle was blue.".` — two full
 * stops and a stray quote, on every single-source claim.
 */
function quote(statement: string): string {
  const trimmed = statement.trim().replace(/[.!?]+$/, "");
  return `"${trimmed.length > 90 ? `${trimmed.slice(0, 87)}…` : trimmed}"`;
}

/** What a status obliges the document to do. Carried through to the render. */
export function obligationFor(status: EpistemicStatus): string {
  return EPISTEMIC_MEANINGS[status].required;
}
