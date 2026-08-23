// A qualitative findings section: the themes, and the extracts that made them.
//
// Transcription, and it is worth saying exactly which part is transcription.
// A theme's *name* and its statement are the researcher's; what this writes is
// the structure around them — how many extracts, from how many documents, and
// the extracts themselves, sliced from the transcripts. None of that is
// interpretation, and all of it is what a findings chapter is mostly made of.
//
// What it does not write is what any of it means. That is the discussion, and
// `document.ts` refuses it.

import { reachOf, type Theme } from "../qualitative/themes.ts";
import type { Code } from "../qualitative/codebook.ts";
import type { SaturationReading } from "../qualitative/saturation.ts";

export interface FindingsInput {
  themes: readonly Theme[];
  /** Codes in the data that no theme gathered. Named, never hidden. */
  uncovered: readonly Code[];
  saturation: SaturationReading;
  /** How each document should be named in a quotation attribution. */
  nameOf: (documentId: string) => string;
  /** At most this many extracts under each theme. */
  extractsPerTheme?: number;
}

export const DEFAULT_EXTRACTS_PER_THEME = 4;

/**
 * How many extracts to show, and why it is capped.
 *
 * A theme with sixty extracts printed in full is not a findings chapter, it is
 * an appendix — and the researcher has to choose which ones carry the argument
 * anyway. The cap makes that choice visible: the count of what was left out is
 * stated, so the omission is a number on the page rather than a silence.
 */
export function findingsSection(input: FindingsInput): string {
  const limit = input.extractsPerTheme ?? DEFAULT_EXTRACTS_PER_THEME;
  const lines: string[] = ["## Findings", ""];

  if (input.themes.length === 0) {
    lines.push(
      "No themes have been assembled yet. A theme is gathered from codes that were applied to the transcripts, and a theme with no extracts behind it is not written here at all.",
    );
    return lines.join("\n") + "\n";
  }

  lines.push(
    `${input.themes.length} theme${input.themes.length === 1 ? " was" : "s were"} assembled from the coded transcripts.`,
    "",
  );

  for (const theme of input.themes) {
    lines.push(`### ${theme.label}`);
    lines.push("");
    if (theme.statement.trim() !== "") {
      lines.push(theme.statement.trim());
      lines.push("");
    }
    lines.push(reachOf(theme));
    lines.push("");

    const shown = theme.extracts.slice(0, limit);
    for (const extract of shown) {
      // Attributed to the document, always. An unattributed quotation in a
      // findings chapter is the one an examiner asks about first.
      lines.push(`> ${extract.text.replace(/\s+/g, " ").trim()}`);
      lines.push(`>`);
      lines.push(`> — ${input.nameOf(extract.documentId)}`);
      lines.push("");
    }

    const held = theme.extracts.length - shown.length;
    if (held > 0) {
      lines.push(
        `*${held} further extract${held === 1 ? "" : "s"} under this theme ${held === 1 ? "is" : "are"} not shown. Choose the ones that carry the argument.*`,
      );
      lines.push("");
    }
  }

  if (input.uncovered.length > 0) {
    lines.push("### Codes outside the themes", "");
    lines.push(
      `${input.uncovered.map((code) => code.label).join(", ")} ${input.uncovered.length === 1 ? "was applied to the data and is" : "were applied to the data and are"} not gathered under any theme. That is usually the material worth looking at again rather than an omission to tidy away.`,
      "",
    );
  }

  lines.push("### Saturation", "");
  lines.push(input.saturation.account, "");

  return lines.join("\n").trimEnd() + "\n";
}
