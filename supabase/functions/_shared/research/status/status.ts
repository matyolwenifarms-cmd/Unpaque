// What a study holds, as sentences rather than as tabs.
//
// Eight stages is eight questions a researcher who has not used this before
// cannot answer. The same eight things described as facts about their own work
// is reading, and it teaches the product on the way past: somebody who has
// never heard of a coherence check learns what one is from a line saying their
// paradigm does not pull against their sampling.
//
// **Only what is there is said.** A study that has screened nothing gets no
// line about screening, and that is a decision rather than an oversight: most
// research never screens, never runs a t-test, never holds a corpus, and a
// panel listing everything undone is a to-do list the researcher did not write
// and mostly should not act on. A qualitative student does not need six
// reproaches about quantitative stages they will never open.
//
// The single exception is `next`, which offers one thing — and offers it,
// rather than instructing. A tool that tells a researcher what to do next is
// making a claim about their study it is in no position to make.

import type { ResearchStage } from "./stages.ts";

export type StatusTone = "holds" | "attention";

export interface StatusLine {
  readonly says: string;
  /** Where this line goes when it is followed. Every line is a way in. */
  readonly stage: ResearchStage;
  /**
   * `attention` for something waiting on a decision the researcher has to
   * make. Never for a count — a study holding forty papers is not a
   * problem, and colouring it as one is how somebody learns to ignore the
   * colour.
   */
  readonly tone: StatusTone;
}

export interface Suggestion {
  readonly says: string;
  readonly stage: ResearchStage;
}

export interface Status {
  /** What this study holds. Empty for a study with nothing in it yet. */
  readonly holds: readonly StatusLine[];
  /** One thing worth doing, or nothing when it cannot honestly name one. */
  readonly next: Suggestion | null;
}

/**
 * Counts, and only counts.
 *
 * Deliberately cheap: every field here comes from a `head: true` count, so the
 * panel costs one round trip per subsystem and no rows. The compelling line
 * — how many figures in the corpus disagree — is not here, because
 * finding it means loading every page of every paper, and a status panel that
 * takes four seconds is a status panel nobody waits for. The Papers stage
 * computes it where the pages are already loaded.
 */
export interface StudySnapshot {
  readonly papers: number;
  readonly papersWithoutText: number;
  readonly relations: number;
  readonly screened: number;
  readonly screeningUndecided: number;
  readonly screeningIncluded: number;
  readonly paradigmDeclared: boolean;
  readonly documents: number;
  readonly codes: number;
  readonly codings: number;
  readonly themes: number;
  readonly analyses: number;
  readonly references: number;
}

export const EMPTY: StudySnapshot = {
  papers: 0,
  papersWithoutText: 0,
  relations: 0,
  screened: 0,
  screeningUndecided: 0,
  screeningIncluded: 0,
  paradigmDeclared: false,
  documents: 0,
  codes: 0,
  codings: 0,
  themes: 0,
  analyses: 0,
  references: 0,
};

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** What the study holds, in the order the work tends to happen. */
function holdsOf(snapshot: StudySnapshot): StatusLine[] {
  const lines: StatusLine[] = [];

  if (snapshot.references > 0) {
    lines.push({
      says: `${plural(snapshot.references, "reference")} kept, each one resolved at its registration agency.`,
      stage: "literature",
      tone: "holds",
    });
  }

  if (snapshot.papers > 0) {
    const scans = snapshot.papersWithoutText;
    // Three cases rather than a plural helper, because the awkward one is a
    // single paper that is itself a scan: "1 paper held. One of them has no
    // text layer" is about a them that does not exist.
    const held = `${plural(snapshot.papers, "paper")} held`;
    const said = scans === 0
      ? `${held}, with their text.`
      : scans === snapshot.papers && snapshot.papers === 1
        ? `${held}, and it has no text layer, so it cannot be searched or quoted.`
        : scans === 1
          ? `${held}. One of them has no text layer, so it cannot be searched or quoted.`
          : `${held}. ${scans} of them have no text layer, so they cannot be searched or quoted.`;
    lines.push({ says: said, stage: "papers", tone: "holds" });
  }

  if (snapshot.relations > 0) {
    lines.push({
      says: `${plural(snapshot.relations, "relation")} recorded between them, each with your reason.`,
      stage: "papers",
      tone: "holds",
    });
  }

  if (snapshot.screened > 0) {
    lines.push({
      says: snapshot.screeningUndecided > 0
        ? `${plural(snapshot.screened, "record")} in screening, ${snapshot.screeningUndecided} still waiting on you.`
        : `${plural(snapshot.screened, "record")} screened through, ${snapshot.screeningIncluded} included.`,
      stage: "screening",
      tone: snapshot.screeningUndecided > 0 ? "attention" : "holds",
    });
  }

  if (snapshot.paradigmDeclared) {
    lines.push({
      says: "Your method is declared, and the coherence check runs on it.",
      stage: "method",
      tone: "holds",
    });
  }

  if (snapshot.documents > 0) {
    const coded = snapshot.codings > 0
      ? `${plural(snapshot.codings, "passage")} coded against ${plural(snapshot.codes, "code")}.`
      : `${plural(snapshot.codes, "code")} written, and nothing coded against ${snapshot.codes === 1 ? "it" : "them"} yet.`;
    lines.push({
      says: `${plural(snapshot.documents, "document")} open for coding. ${snapshot.codes > 0 ? coded : "No codebook yet."}`,
      stage: "code",
      tone: "holds",
    });
  }

  if (snapshot.themes > 0) {
    lines.push({
      says: `${plural(snapshot.themes, "theme")} assembled from those codings.`,
      stage: "code",
      tone: "holds",
    });
  }

  if (snapshot.analyses > 0) {
    lines.push({
      says: `${plural(snapshot.analyses, "analysis", "analyses")} run, with the assumption checks beside ${snapshot.analyses === 1 ? "it" : "them"}.`,
      stage: "analyse",
      tone: "holds",
    });
  }

  return lines;
}

/**
 * One thing worth doing, phrased as an offer.
 *
 * Ordered by what follows from what is already there rather than by a fixed
 * pipeline, because there is no fixed pipeline: a systematic review and a
 * phenomenological study share three of these stages and disagree about the
 * rest. Where nothing in the study implies a next step, this returns nothing
 * — which is the honest answer, and better than inventing one.
 */
function nextOf(snapshot: StudySnapshot): Suggestion | null {
  if (snapshot.screeningUndecided > 0) {
    return {
      says: `${snapshot.screeningUndecided} records are waiting on a decision. The flow diagram appears once none are.`,
      stage: "screening",
    };
  }

  if (snapshot.papers >= 2 && snapshot.relations === 0) {
    return {
      says: "Your papers can be checked against each other for figures that disagree.",
      stage: "papers",
    };
  }

  if (snapshot.references > 0 && snapshot.papers === 0) {
    return {
      says: "You have references but none of the papers themselves. Holding them lets everything else read what is in them.",
      stage: "papers",
    };
  }

  if (snapshot.documents > 0 && snapshot.codes === 0) {
    return {
      says: "There is a document open for coding and no codebook yet.",
      stage: "code",
    };
  }

  if (snapshot.codings > 0 && snapshot.themes === 0) {
    return {
      says: "You have codings and no themes assembled from them.",
      stage: "code",
    };
  }

  if (snapshot.papers === 0 && snapshot.references === 0 && snapshot.documents === 0) {
    return {
      says: "Hand over a proposal and it will read the references and the design out of it.",
      stage: "proposal",
    };
  }

  return null;
}

export function readStatus(snapshot: StudySnapshot): Status {
  return { holds: holdsOf(snapshot), next: nextOf(snapshot) };
}
