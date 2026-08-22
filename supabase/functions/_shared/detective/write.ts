// The dossier as a document somebody can read, or hand over.
//
// Markdown, for the same reason the results section is: it has to survive a
// paste into Word, into an email, and into a plain-text field, and asterisks
// are the one convention all three either honour or leave legible.
//
// The order is §4's and is not negotiable in a rewrite. What the evidence
// carries, then what is not carried, then what is unknown, then what does not
// fit. A document that leads with findings and buries the gaps has told the
// reader what to think before telling them what is missing — and in an
// investigation the gaps are usually the part that decides whether the
// findings hold at all.
//
// Nothing here concludes. Every sentence is a statement about the case file:
// how many independent sources support a claim, what contradicts it, what
// would settle it. "Who did it" is not a question this document answers, and
// the absence is the product.

import { EPISTEMIC_MEANINGS } from "./epistemic.ts";
import type { ClaimReading, Dossier } from "./dossier.ts";

/** How the document identifies itself, so a printed copy cannot be mistaken. */
export const PROVENANCE =
  "Assembled from the case file. Every statement below describes what the file contains — how many independent sources support a claim, what contradicts it, and what is not established. Nothing here is a conclusion about what happened.";

export function writeDossier(dossier: Dossier, generatedAt = new Date()): string {
  const parts: string[] = [`# ${dossier.title}`];

  if (dossier.question) parts.push(`**The question:** ${dossier.question}`);
  parts.push(`*${PROVENANCE}*`);

  // --- What the evidence carries ------------------------------------------
  parts.push("## What the evidence supports");
  if (dossier.established.length === 0) {
    // Said rather than left blank. An empty section reads as an oversight;
    // this reads as the finding it is.
    parts.push(
      "Nothing in this file is supported by two independent sources with nothing contradicting it. That is the state of the record, not a rendering fault.",
    );
  } else {
    for (const reading of dossier.established) parts.push(claimBlock(reading));
  }

  // --- What it does not ----------------------------------------------------
  parts.push("## What the evidence does not yet carry");
  if (dossier.unsupported.length === 0) {
    parts.push("Every claim in the file is supported by two or more independent sources.");
  } else {
    for (const reading of dossier.unsupported) parts.push(claimBlock(reading));
  }

  // --- What is unknown -----------------------------------------------------
  parts.push("## What remains unknown");
  for (const unknown of dossier.unknowns) parts.push(`- ${unknown}`);

  // --- What does not fit ---------------------------------------------------
  parts.push("## What does not fit");
  if (dossier.discrepancies.length === 0 && dossier.duplicateSources.length === 0) {
    parts.push(
      "No conflict was found among the records assigned to a shared moment. Records not assigned to one were not compared.",
    );
  }

  for (const discrepancy of dossier.discrepancies) {
    const lines = [
      `**${discrepancy.a.label}** and **${discrepancy.b.label}** describe the same moment ${discrepancy.differenceMinutes} minutes apart.`,
      "",
      // §9: the explanations, with inaccuracy among them and never first.
      // Naming only the difference and leaving the reader to supply a reason
      // is how a document implies deceit without saying it.
      "Possible explanations, none established:",
      ...discrepancy.explanations.map(
        (explanation) => `- ${explanation.summary} *Distinguished by:* ${explanation.distinguishedBy}`,
      ),
    ];
    parts.push(lines.join("\n"));
  }

  for (const duplicate of dossier.duplicateSources) {
    parts.push(
      `**${duplicate.titles.join("** and **")}** are byte-identical. They are one source, and are counted once above — a story carried by several outlets is not several sources.`,
    );
  }

  // --- The timeline --------------------------------------------------------
  if (dossier.events.length > 0 || dossier.unplaced.length > 0) {
    parts.push("## Sequence");
    if (dossier.events.length > 0) {
      parts.push(
        [
          "| When | What | How well known | Established by |",
          "|---|---|---|---|",
          ...dossier.events.map(
            (event) =>
              `| ${event.at} | ${event.label} | ${event.certainty} | ${event.origin} |`,
          ),
        ].join("\n"),
      );
    }
    if (dossier.unplaced.length > 0) {
      parts.push(
        `Outside the sequence, with no time recorded: ${dossier.unplaced.map((event) => event.label).join("; ")}.`,
      );
    }
  }

  parts.push(
    `---\n\n*Assembled ${generatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC. Re-reading the file will produce a different document if the file has changed.*`,
  );

  return parts.join("\n\n");
}

function claimBlock(reading: ClaimReading): string {
  const meaning = EPISTEMIC_MEANINGS[reading.claim.status];
  const lines = [
    `**${reading.claim.statement.trim()}**`,
    "",
    `*${meaning.label}.* ${reading.reading}`,
  ];

  if (reading.claim.assertedBy?.trim()) {
    lines.push(`Asserted by: ${reading.claim.assertedBy.trim()}`);
  }

  if (reading.claim.evidence.length > 0) {
    lines.push("", "Evidence:");
    for (const item of reading.claim.evidence) {
      const excerpt = item.excerpt?.trim() ? ` — "${item.excerpt.trim()}"` : "";
      lines.push(`- ${item.classification.replace(/_/g, " ")}: ${item.sourceTitle}${excerpt}`);
    }
  }

  // Always. A finding with no next step is a dead end dressed as a conclusion.
  lines.push("", `*What would settle it:* ${reading.wouldSettleIt}`);
  return lines.join("\n");
}
