// Themes, assembled from codes, and never from nothing.
//
// §7: "Themes are assembled *from* codes and show their constituent extracts -
// a theme with no extracts does not exist."
//
// That is the rule this module makes unrepresentable rather than checks. A
// `Theme` cannot be constructed; it is only ever *derived*, by `assembleThemes`,
// from codings that actually exist. There is no exported constructor and no
// way to hand one an empty extract list, because the failure it prevents is the
// most common one in qualitative work: a themes chapter written first and
// evidenced afterwards, where the theme is the researcher's intuition and the
// extracts are whatever could be found to fit it.
//
// The direction matters. Codes come from the data, themes come from the codes,
// and the extracts under a theme are the ones that were coded - not a
// selection made to illustrate a heading.

import type { Code } from "./codebook.ts";
import { extractOf, type Coding } from "./coding.ts";

export interface Extract {
  codingId: string;
  documentId: string;
  codeId: string;
  /** Sliced from the document. Never a stored copy. */
  text: string;
  start: number;
  end: number;
  memo?: string | null;
}

export interface Theme {
  id: string;
  label: string;
  /** The analyst's account of what holds these codes together. */
  statement: string;
  /** The codes gathered under it. Never empty - see below. */
  codes: Code[];
  /**
   * Every extract those codes are applied to.
   *
   * Guaranteed non-empty: `assembleThemes` drops a theme with none rather than
   * returning it hollow. A heading with no data beneath it is the shape of the
   * problem this whole module is about.
   */
  extracts: Extract[];
  /** How many separate documents contribute. One is a finding about one person. */
  documents: number;
}

/** A theme as the analyst declares it, before the data decides whether it exists. */
export interface ThemeDraft {
  id: string;
  label: string;
  statement: string;
  codeIds: string[];
}

export interface ThemeOutcome {
  themes: Theme[];
  /**
   * Drafts that had no extract behind them, and why.
   *
   * Reported rather than silently dropped. A researcher who wrote a theme and
   * cannot find it on screen will assume the software lost it; told that
   * nothing in the data was coded to it, they have learnt something about the
   * analysis.
   */
  withoutEvidence: Array<{ draft: ThemeDraft; says: string }>;
}

export function assembleThemes(
  drafts: readonly ThemeDraft[],
  codes: readonly Code[],
  codings: readonly Coding[],
  documents: ReadonlyMap<string, string>,
): ThemeOutcome {
  const themes: Theme[] = [];
  const withoutEvidence: ThemeOutcome["withoutEvidence"] = [];

  for (const draft of drafts) {
    const gathered = draft.codeIds
      .map((id) => codes.find((code) => code.id === id))
      .filter((code): code is Code => code !== undefined);

    if (gathered.length === 0) {
      withoutEvidence.push({
        draft,
        says: "No codes are gathered under this theme. A theme is assembled from codes.",
      });
      continue;
    }

    const extracts: Extract[] = [];
    for (const coding of codings) {
      if (!gathered.some((code) => code.id === coding.codeId)) continue;
      const text = documents.get(coding.documentId);
      if (text === undefined) continue;
      extracts.push({
        codingId: coding.id,
        documentId: coding.documentId,
        codeId: coding.codeId,
        text: extractOf(coding, text),
        start: coding.start,
        end: coding.end,
        memo: coding.memo ?? null,
      });
    }

    if (extracts.length === 0) {
      withoutEvidence.push({
        draft,
        says: `Nothing in the data is coded to ${gathered.map((code) => `"${code.label}"`).join(" or ")}, so this theme has no extracts and does not exist yet.`,
      });
      continue;
    }

    themes.push({
      id: draft.id,
      label: draft.label,
      statement: draft.statement,
      codes: gathered,
      extracts,
      documents: new Set(extracts.map((extract) => extract.documentId)).size,
    });
  }

  return { themes, withoutEvidence };
}

/**
 * What a reader should be told about how far a theme reaches.
 *
 * A theme drawn entirely from one participant is a finding about that
 * participant. It may still be the most interesting thing in the study, and
 * the point is not to suppress it but to stop it being reported as though
 * several people said it.
 */
export function reachOf(theme: Theme): string {
  if (theme.documents === 1) {
    return `Every extract under this theme comes from one document. That is a finding about one account, not a pattern across the sample.`;
  }
  return `${theme.extracts.length} extracts across ${theme.documents} documents.`;
}

/**
 * Codes that no theme has gathered.
 *
 * The other half of the same honesty. Themes assembled from a subset of the
 * codes look complete on screen, and the codes left out are exactly the ones
 * that did not fit the story - which is the material worth looking at again.
 */
export function uncoveredCodes(
  themes: readonly Theme[],
  codes: readonly Code[],
  codings: readonly Coding[],
): Code[] {
  const covered = new Set(themes.flatMap((theme) => theme.codes.map((code) => code.id)));
  const applied = new Set(codings.map((coding) => coding.codeId));
  return codes.filter((code) => applied.has(code.id) && !covered.has(code.id));
}
