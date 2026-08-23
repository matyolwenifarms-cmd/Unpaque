// Cohen's kappa between two coders, and the four ways it is undefined.
//
// The number is easy. What this module is mostly about is refusing to print it
// when it does not mean anything, because a kappa that is undefined arrives as
// 0/0 and the careless thing is to report the 0 — which reads as "the coders
// agreed no better than chance" when what happened was that they agreed
// completely.
//
// So `Agreement` is a discriminated union and there is no optional kappa
// field. The same argument as `Finding` in the quantitative module: a type
// that can hold a partial result will eventually be read as a whole one.

import { normalQuantile } from "../analytics/distributions.ts";
import type { Code } from "./codebook.ts";
import type { Coding } from "./coding.ts";
import { overlaps, unitsOf, type Unit, type UnitKind } from "./units.ts";

/** The four cells, over the units both coders were reading. */
export interface Table {
  /** Both applied the code. */
  both: number;
  /** The first coder only. */
  firstOnly: number;
  /** The second coder only. */
  secondOnly: number;
  /** Neither. The half of kappa that span matching cannot supply. */
  neither: number;
}

export interface ComputedAgreement {
  kind: "computed";
  codeId: string;
  units: number;
  table: Table;
  /** The proportion of units the coders treated the same way. */
  observed: number;
  /** The proportion they would be expected to, coding independently. */
  expected: number;
  kappa: number;
  standardError: number;
  /**
   * The 95% interval, or the reason there isn't one.
   *
   * A union for the same reason `Agreement` is one. When the coders never
   * differ the normal approximation gives a standard error of zero and the
   * interval collapses to [1.00, 1.00] — which reads as certainty that kappa
   * is exactly 1 and is nothing of the kind: perfect agreement on ten
   * paragraphs is a weak claim, and printing a zero-width interval hides
   * exactly the weakness the interval exists to show.
   */
  interval:
    | { kind: "estimated"; low: number; high: number }
    | { kind: "degenerate"; says: string };
  /**
   * |both - neither| / units. High when a code is very rare or very common.
   *
   * The kappa paradox: at 97% observed agreement on a code applied to three
   * units in a hundred, kappa can sit near zero. Reporting the kappa alone
   * there tells a reader the coders disagreed, which is false.
   */
  prevalenceIndex: number;
  /** |firstOnly - secondOnly| / units. High when one coder applies it far more. */
  biasIndex: number;
  /**
   * What a reader must be told alongside the number.
   *
   * A list, not one. Several are true at once often enough — a rare code will
   * usually also have an interval spanning zero — and a single field forces a
   * choice that silently hides whichever was ranked second.
   */
  cautions: string[];
}

export interface UndefinedAgreement {
  kind: "undefined";
  codeId: string;
  /** Why, in a sentence somebody can act on. */
  says: string;
}

export type Agreement = ComputedAgreement | UndefinedAgreement;

/** Whether there is anything to compare at all. */
export type AgreementOutcome =
  | { kind: "read"; units: number; unitKind: UnitKind; agreements: Agreement[] }
  | { kind: "not_possible"; says: string };

const Z = normalQuantile(0.975);

/**
 * Read agreement between two coders across a study.
 *
 * `documents` is every document both coders worked on, and units are taken
 * from all of them together — a kappa per document would be computed on
 * denominators of twenty and would swing wildly for reasons that are about
 * transcript length rather than about coding.
 */
export function agreementBetween(
  first: string,
  second: string,
  codes: readonly Code[],
  codings: readonly Coding[],
  documents: ReadonlyMap<string, string>,
  unitKind: UnitKind,
): AgreementOutcome {
  if (first === second) {
    return {
      kind: "not_possible",
      says: "Agreement is between two different coders. Comparing somebody with themselves gives a perfect score that means nothing.",
    };
  }

  const all: Array<{ documentId: string; unit: Unit }> = [];
  for (const [documentId, text] of documents) {
    for (const unit of unitsOf(text, unitKind)) all.push({ documentId, unit });
  }

  if (all.length === 0) {
    return { kind: "not_possible", says: "There are no transcripts to compare coding across." };
  }

  const applied = (coderId: string, codeId: string, documentId: string, unit: Unit) =>
    codings.some(
      (coding) =>
        coding.coderId === coderId &&
        coding.codeId === codeId &&
        coding.documentId === documentId &&
        overlaps(unit, coding),
    );

  const agreements = codes.map<Agreement>((code) => {
    const table: Table = { both: 0, firstOnly: 0, secondOnly: 0, neither: 0 };
    for (const { documentId, unit } of all) {
      const a = applied(first, code.id, documentId, unit);
      const b = applied(second, code.id, documentId, unit);
      if (a && b) table.both += 1;
      else if (a) table.firstOnly += 1;
      else if (b) table.secondOnly += 1;
      else table.neither += 1;
    }
    return kappaFrom(code.id, table);
  });

  return { kind: "read", units: all.length, unitKind, agreements };
}

/**
 * Kappa from a 2x2 table, or the reason there isn't one.
 *
 * Exported because the degenerate cases are the interesting part and testing
 * them through the whole pipeline would mean constructing transcripts to
 * produce each one.
 */
export function kappaFrom(codeId: string, table: Table): Agreement {
  const { both, firstOnly, secondOnly, neither } = table;
  const n = both + firstOnly + secondOnly + neither;

  if (n === 0) {
    return { kind: "undefined", codeId, says: "There are no units to compare." };
  }
  if (both === 0 && firstOnly === 0 && secondOnly === 0) {
    return {
      kind: "undefined",
      codeId,
      says: "Neither coder applied this code to anything, so there is no agreement to measure. That is a fact about the codebook, not about the coders.",
    };
  }

  const observed = (both + neither) / n;
  const firstApplied = both + firstOnly;
  const secondApplied = both + secondOnly;
  const expected =
    (firstApplied * secondApplied + (n - firstApplied) * (n - secondApplied)) / (n * n);

  // 1 - expected is the denominator, and working out when it vanishes is worth
  // doing rather than guessing at. Expected agreement is 1 only when both
  // coders applied the code to every unit, or when neither applied it at all —
  // the second is already returned above. One coder using it and the other not
  // does *not* make it undefined: expected agreement is then low, and kappa is
  // a perfectly well defined 0.
  //
  // In the surviving case kappa is 0/0. The coders agreed completely, and the
  // arithmetic cannot tell that from agreeing by chance, because with no
  // variation left there was no chance involved.
  if (1 - expected <= Number.EPSILON) {
    return {
      kind: "undefined",
      codeId,
      says: `Both coders applied this code to every unit, so chance agreement is total and kappa is undefined. They agreed on all ${n} of them — which is not the same as agreeing by chance.`,
    };
  }

  const kappa = (observed - expected) / (1 - expected);
  // Fleiss's approximation. Adequate for the interval a methods section
  // reports, and the interval is the point: a kappa from forty units is a
  // different claim from the same kappa out of four hundred, and only the
  // width shows it.
  const standardError = Math.sqrt(
    (observed * (1 - observed)) / (n * (1 - expected) * (1 - expected)),
  );

  const prevalenceIndex = Math.abs(both - neither) / n;
  const biasIndex = Math.abs(firstOnly - secondOnly) / n;

  const interval: ComputedAgreement["interval"] =
    standardError > 0
      ? {
          kind: "estimated",
          low: Math.max(-1, kappa - Z * standardError),
          high: Math.min(1, kappa + Z * standardError),
        }
      : {
          kind: "degenerate",
          says: `The coders never differed on this code, so the usual approximation gives an interval of zero width. That is an artefact of the method, not a finding: agreement this complete across ${n} units is a weaker claim than a zero-width interval makes it look.`,
        };

  return {
    kind: "computed",
    codeId,
    units: n,
    table,
    observed,
    expected,
    kappa,
    standardError,
    interval,
    prevalenceIndex,
    biasIndex,
    cautions: cautionsFor(
      observed, kappa, prevalenceIndex, biasIndex, firstApplied, secondApplied, interval,
    ),
  };
}

function cautionsFor(
  observed: number,
  kappa: number,
  prevalenceIndex: number,
  biasIndex: number,
  firstApplied: number,
  secondApplied: number,
  interval: ComputedAgreement["interval"],
): string[] {
  const cautions: string[] = [];

  // Kappa is defined here and is usually near zero, which reads as "the coders
  // disagreed". What actually happened is that one of them is not using the
  // code at all, and that is a question for the codebook rather than a
  // measurement of anything.
  if (firstApplied === 0 || secondApplied === 0) {
    cautions.push(
      "One coder never applied this code. The kappa is real arithmetic but it is not a measure of how well they agree — it is a sign that one of them is not using the code, which the codebook has to settle first.",
    );
  }

  // The paradox, stated where it applies rather than as a general note nobody
  // reads. Byrt, Bishop and Carlin (1993) is the usual citation.
  if (prevalenceIndex > 0.8 && observed > 0.8 && kappa < 0.6) {
    cautions.push(
      `The coders agreed on ${(observed * 100).toFixed(0)}% of units, and kappa is still low because this code is very unevenly distributed — it is applied to almost none of the units, or almost all of them. Report the observed agreement alongside the kappa, or the number reads as disagreement that did not happen.`,
    );
  }

  if (biasIndex > 0.2) {
    cautions.push(
      "One coder applies this code far more often than the other. That is a difference in how the code is being read, and it is worth settling in the codebook before treating the kappa as a measure of anything else.",
    );
  }

  // An interval spanning zero means the data do not distinguish this from
  // chance agreement, and the conventional label beside it will still read
  // "moderate" or "substantial". Said because a reader who takes the point
  // estimate and leaves the interval behind is the ordinary case rather than
  // the careless one.
  if (interval.kind === "estimated" && interval.low < 0 && interval.high > 0) {
    cautions.push(
      "The interval includes zero, so these data do not distinguish this from agreement by chance. The point estimate and the label beside it are both weaker claims than they look — usually this means too few units carry the code to say anything yet.",
    );
  }

  return cautions;
}

/**
 * Landis and Koch's labels, attributed rather than asserted.
 *
 * They are a 1977 convention, not a standard, and they are disputed — the
 * cut-offs were offered as "arbitrary but useful divisions". They are here
 * because a researcher who is not given one will find one and apply it without
 * the caveat; naming the source is what makes the caveat travel with it.
 */
export function conventionalLabel(kappa: number): string {
  if (kappa < 0) return "less agreement than chance";
  if (kappa < 0.21) return "slight";
  if (kappa < 0.41) return "fair";
  if (kappa < 0.61) return "moderate";
  if (kappa < 0.81) return "substantial";
  return "almost perfect";
}

/** APA form. Bounded, so the leading zero goes, as it does for r and for p. */
export function reportKappa(agreement: ComputedAgreement, unitKind: UnitKind): string {
  const bounded = (value: number) =>
    (value < 0 ? "-" : "") + Math.abs(value).toFixed(2).replace(/^0\./, ".");
  const units = `${agreement.units} ${unitKind === "paragraph" ? "paragraphs" : "lines"}`;
  const observed = `${(agreement.observed * 100).toFixed(0)}% observed agreement`;
  // No interval rather than a zero-width one. "95% CI [1.00, 1.00]" in a
  // methods chapter is a claim of certainty nobody made. The comma goes with
  // it: without the clause, "κ = 1.00, across 10 paragraphs" has a comma
  // separating nothing.
  const interval =
    agreement.interval.kind === "estimated"
      ? `, 95% CI [${bounded(agreement.interval.low)}, ${bounded(agreement.interval.high)}], `
      : " ";
  return `Cohen's κ = ${bounded(agreement.kappa)}${interval}across ${units}, with ${observed}.`;
}
