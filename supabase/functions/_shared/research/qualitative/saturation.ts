// Saturation, computed rather than asserted.
//
// `coherence.ts` refuses a study that claims thematic saturation with no
// account of how it was judged, citing Braun & Clarke (2021), and the
// methodology statement leaves a gap where the account belongs. This is what
// fills it - from the coding record, which is the only place the answer
// actually is.
//
// The claim "saturation was reached" is about a process: documents were coded
// in some order, and at some point new ones stopped producing new codes. That
// is a fact about the sequence, and a researcher who kept the sequence can
// state it exactly. One who did not cannot, and no amount of confidence
// substitutes.
//
// **This does not decide whether saturation was reached.** It reports what the
// coding shows and writes the sentence; whether the number of documents since
// the last new code is enough is a judgement about the field and the question,
// and it belongs to the researcher and their supervisor. Braun and Clarke's
// argument is partly that the concept does not travel to every design at all.

import type { Coding } from "./coding.ts";

export interface SaturationReading {
  /** Documents in the order they were coded. */
  documents: string[];
  /** For each, how many codes appeared in it for the first time. */
  newCodesPerDocument: Array<{ documentId: string; newCodes: number; total: number }>;
  /** How many documents at the end produced nothing new. */
  documentsWithoutNewCodes: number;
  /** The document in which the last new code appeared, if any. */
  lastNewCodeIn: string | null;
  /** The sentence a methodology chapter can carry. */
  account: string;
}

/**
 * Read the coding record in the order documents were coded.
 *
 * `order` is supplied rather than inferred: codings carry no timestamp here,
 * and inferring the sequence from ids would be a guess presented as a fact
 * about how the analysis proceeded. If the researcher did not record the
 * order, the honest answer is that saturation cannot be assessed - which is
 * what this returns.
 */
export function readSaturation(
  codings: readonly Coding[],
  order: readonly string[],
): SaturationReading {
  if (order.length === 0) {
    return {
      documents: [],
      newCodesPerDocument: [],
      documentsWithoutNewCodes: 0,
      lastNewCodeIn: null,
      account:
        "The order in which documents were coded is not recorded, so saturation cannot be assessed from this data. Saturation is a claim about a sequence.",
    };
  }

  const seen = new Set<string>();
  const perDocument: SaturationReading["newCodesPerDocument"] = [];
  let lastNewCodeIn: string | null = null;

  for (const documentId of order) {
    const codesHere = new Set(
      codings.filter((coding) => coding.documentId === documentId).map((coding) => coding.codeId),
    );
    let newCodes = 0;
    for (const codeId of codesHere) {
      if (!seen.has(codeId)) {
        seen.add(codeId);
        newCodes += 1;
      }
    }
    if (newCodes > 0) lastNewCodeIn = documentId;
    perDocument.push({ documentId, newCodes, total: seen.size });
  }

  const withoutNew = lastNewCodeIn === null
    ? order.length
    : order.length - 1 - order.lastIndexOf(lastNewCodeIn);

  return {
    documents: [...order],
    newCodesPerDocument: perDocument,
    documentsWithoutNewCodes: withoutNew,
    lastNewCodeIn,
    account: accountFor(order.length, withoutNew, seen.size, lastNewCodeIn),
  };
}

function accountFor(
  total: number,
  withoutNew: number,
  codeCount: number,
  lastNewCodeIn: string | null,
): string {
  if (codeCount === 0) {
    return "No codes have been applied yet, so there is nothing to say about saturation.";
  }

  const documents = `${total} ${total === 1 ? "document" : "documents"}`;
  const wereCoded = total === 1 ? "was coded" : "were coded";
  const codes = `${codeCount} ${codeCount === 1 ? "code" : "codes"}`;

  if (lastNewCodeIn === null || withoutNew === 0) {
    // The last document still produced something new, which is the one state
    // that says plainly: not yet.
    return `${documents} ${wereCoded}, producing ${codes}. The most recently coded document still produced codes not seen before, so coding has not stopped yielding new categories.`;
  }

  // Written out rather than left as "N document(s) were coded". This sentence
  // exists to be carried into a methodology chapter, and a researcher who has
  // to hand-edit the plurals out of it will write their own instead - at which
  // point the software has done nothing.
  const since = withoutNew === 1
    ? "the document coded after it produced no codes"
    : `the ${withoutNew} documents coded after it produced no codes`;

  return `${documents} ${wereCoded} in sequence, producing ${codes} in total. The last new code appeared in the ${ordinal(total - withoutNew)} document; ${since} that were not already in the frame. Whether that is sufficient for this study is a judgement about the question and the field, not a threshold.`;
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13
    ? "th"
    : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}
