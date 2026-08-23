// What an investigative document appears to be, offered and never decided.
//
// The portal exists so somebody can hand the system a folder and not have to
// know what it wants. That only works if the system says what it thinks each
// file is — and it stops working the moment it says so with more confidence
// than it has.
//
// **Every reading here is a suggestion with its evidence attached, and the
// person confirms it.** A docket filed as a witness statement corrupts every
// count downstream: independent support, contradiction detection, the
// timeline. The officer can tell in two seconds and the machine cannot, so the
// machine shows its reason and gets out of the way.
//
// The patterns are deliberately shallow. A deeper reading of prose is a job
// for a model, and a heuristic that pretends to do it would be confidently
// wrong on exactly the documents that matter — the unusual ones.

import type { SourceKind } from "../epistemic.ts";

export interface Reading {
  /** The source kind to suggest, matching what the case file already uses. */
  suggests: SourceKind;
  /** What in the document points that way. Shown, always. */
  because: string;
  /**
   * How much the evidence carries. Three values, not a percentage: a number
   * here would be read as a measurement and it is a rule of thumb.
   */
  strength: "clear" | "likely" | "guess";
}

interface Pattern {
  suggests: SourceKind;
  strength: Reading["strength"];
  test: RegExp;
  because: string;
}

// Ordered. The first match wins, so the specific ones come before the general.
const PATTERNS: readonly Pattern[] = [
  {
    suggests: "official_record",
    strength: "clear",
    test: /\b(?:in the (?:high|magistrate'?s?|supreme|constitutional) court|case (?:no|number)[.: ]|held at|before (?:the )?honourable)\b/i,
    because: "It carries a court heading and a case number.",
  },
  {
    suggests: "official_record",
    strength: "clear",
    test: /\b(?:charge sheet|docket|cas \d+\/\d+|occurrence book|ob \d+)\b/i,
    because: "It names a docket or charge sheet.",
  },
  {
    suggests: "testimony",
    strength: "clear",
    test: /\b(?:i,? the undersigned|do hereby (?:declare|state)|affidavit|sworn statement|deposes and says|commissioner of oaths)\b/i,
    because: "It reads as a sworn statement.",
  },
  {
    suggests: "testimony",
    strength: "likely",
    test: /\b(?:witness statement|statement of|interviewed by|question:|answer:|q:\s|a:\s)\b/i,
    because: "It is laid out as a statement or an interview.",
  },
  {
    suggests: "official_record",
    strength: "likely",
    test: /\b(?:government gazette|parliamentary|hansard|commission of inquiry|terms of reference|annual report)\b/i,
    because: "It reads as an official or parliamentary record.",
  },
  {
    suggests: "correspondence",
    strength: "clear",
    test: /^(?:from|to|subject|date|message-id):/mi,
    because: "It has email headers.",
  },
  {
    suggests: "correspondence",
    strength: "likely",
    test: /\b(?:dear (?:sir|madam|mr|ms|mrs|dr)|yours (?:sincerely|faithfully)|kind regards)\b/i,
    because: "It is laid out as a letter.",
  },
  {
    suggests: "reporting",
    strength: "likely",
    // `[Bb]y` rather than an `i` flag: the capitalised name either side of it
    // is what distinguishes a byline from the word "by", and a case-insensitive
    // pattern would throw that away and match "signed by john smith reporter"
    // in the body of a letter.
    test: /\b(?:[Bb]y [A-Z][a-z]+ [A-Z][a-z]+,?\s+(?:staff |senior )?(?:reporter|correspondent|journalist)|Reuters|Associated Press|SAPA)\b/,
    because: "It carries a reporter's byline or a wire credit.",
  },
  {
    suggests: "dataset",
    strength: "likely",
    test: /^[^\n]{0,200}(?:,[^\n,]{0,80}){3,}\n(?:[^\n]*,){3,}/,
    because: "Its first lines are comma-separated columns.",
  },
];

/**
 * What this document appears to be.
 *
 * Reads the opening only. A charge sheet says so on its first page, and
 * scanning a 200-page bundle for a phrase that appears once in an annexure
 * finds the annexure rather than the document.
 */
export function readDocument(text: string): Reading {
  const opening = text.slice(0, 4000);

  for (const pattern of PATTERNS) {
    if (pattern.test.test(opening)) {
      return { suggests: pattern.suggests, because: pattern.because, strength: pattern.strength };
    }
  }

  return {
    suggests: "other",
    because: "Nothing in its opening says what kind of document it is.",
    strength: "guess",
  };
}

/**
 * What to suggest for a file that has no readable text.
 *
 * An image or a scanned PDF with no text layer. The suggestion is the format,
 * not a reading of content — there is no content to read, and saying "this
 * looks like a charge sheet" about bytes nobody parsed would be inventing one.
 */
export function readByFormat(kind: string): Reading {
  if (kind === "image") {
    return {
      suggests: "image",
      because: "It is an image. Nothing has read what is in it.",
      strength: "clear",
    };
  }
  if (kind === "pdf") {
    return {
      suggests: "other",
      because: "It is a PDF with no text layer, so it is probably a scan. Nothing has read what is in it.",
      strength: "guess",
    };
  }
  return {
    suggests: "other",
    because: `It is ${kind.replace(/_/g, " ")}, and no text was extracted from it.`,
    strength: "guess",
  };
}
