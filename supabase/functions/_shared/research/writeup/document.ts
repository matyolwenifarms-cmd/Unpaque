// The write-up, assembled from what has actually been established.
//
// This is the most dangerous feature in the product and the module is shaped
// around that. "Write my research report" is exactly where a tool like this
// lies: it produces fluent prose that reads like findings, and a supervisor or
// an examiner cannot tell by reading it that the argument was never made by
// the person submitting it.
//
// So the split is absolute. Some parts of a report are **transcription** — a
// methodology statement is the paradigm's own commitments written out, a
// results section is the numbers in APA order, a reference list is the records
// the providers returned. Copying those correctly is real work that students
// routinely get wrong, and nothing is lost by doing it for them.
//
// Everything else is the researcher's argument about their own study, and this
// module refuses to write any of it. Not "leaves it blank" — refuses, in the
// type: a section that is theirs has no field a body could be put in, so no
// later change can quietly start filling them without the refusal being
// deleted on purpose.
//
// A fluent but unearned paragraph is worse than an obvious hole. The hole gets
// filled; the paragraph gets marked.

export type SectionId =
  | "introduction"
  | "literature"
  | "method"
  | "results"
  | "findings"
  | "discussion"
  | "limitations"
  | "conclusion"
  | "references";

/** A part that was copied out of something already established. */
export interface Transcribed {
  kind: "transcribed";
  id: SectionId;
  title: string;
  markdown: string;
  /** What it was assembled from, so a reader can check it. */
  from: string;
}

/**
 * A part only the researcher can write.
 *
 * There is no markdown field, and that absence is the whole design. An
 * optional one would be filled in eventually — by a later feature, by a
 * well-meaning refactor — and the refusal would disappear without anybody
 * deciding to remove it.
 */
export interface Yours {
  kind: "yours";
  id: SectionId;
  title: string;
  /** What belongs here. */
  says: string;
  /** Why this tool will not write it. */
  because: string;
}

/** A part that would be transcribed, once the work it comes from exists. */
export interface Waiting {
  kind: "waiting";
  id: SectionId;
  title: string;
  /** What to do in Unpaque to fill it. */
  says: string;
}

export type Section = Transcribed | Yours | Waiting;

export interface WriteUp {
  title: string;
  sections: Section[];
  /** Counts, so the screen can say "4 of 9" without recomputing them. */
  transcribed: number;
  yours: number;
  waiting: number;
}

/** What the caller has already produced elsewhere in Research. */
export interface Supplied {
  method?: { markdown: string; gaps: string[] };
  results?: { markdown: string; from: string };
  findings?: { markdown: string; from: string };
  references?: { markdown: string; count: number };
}

// Written once, here, rather than at each call site. The reason a section is
// the researcher's is a claim about research rather than about software, and
// it should read the same wherever it appears.
const YOURS: Record<string, { title: string; says: string; because: string }> = {
  introduction: {
    title: "Introduction",
    says: "The problem, why it matters, and the question this study asks.",
    because:
      "Nothing here knows why you chose this question. A generated introduction would be a plausible reason somebody might have had, and you would be defending it.",
  },
  literature: {
    title: "Literature review",
    says: "What is already known, where it disagrees, and the gap this study sits in.",
    because:
      "The references below are real and verified, and the argument between them is yours. A summary assembled from abstracts reproduces what each paper claims about itself, which is the one thing a literature review is not.",
  },
  discussion: {
    title: "Discussion",
    says: "What your findings mean, how they sit against the literature, and what surprised you.",
    because:
      "This is the section an examiner reads first and the only one that cannot be transcribed from anything. A discussion generated from your own results would restate them in longer sentences and call it interpretation.",
  },
  limitations: {
    title: "Limitations",
    says: "What this design cannot show, and what you would do differently.",
    because:
      "Some limits are already stated in the sections above — the design's, the sample's, the coding's. Which of them actually threaten your conclusion is a judgement about your study.",
  },
  conclusion: {
    title: "Conclusion",
    says: "What you now claim, and how strongly.",
    because:
      "A conclusion is the one sentence you are answerable for. Nothing else should write it.",
  },
};

function yours(id: SectionId): Yours {
  const entry = YOURS[id]!;
  return { kind: "yours", id, title: entry.title, says: entry.says, because: entry.because };
}

/**
 * The skeleton, in the order a report is read.
 *
 * The order is not configurable, and that is deliberate: a document whose
 * discussion precedes its findings is one nobody can follow, and offering the
 * choice implies the tool has no opinion about what a report is.
 */
export function assembleWriteUp(title: string, supplied: Supplied): WriteUp {
  const sections: Section[] = [
    yours("introduction"),
    yours("literature"),

    supplied.method
      ? {
          kind: "transcribed",
          id: "method",
          title: "Methodology",
          // The method statement carries its own marked gaps — the
          // justification above all — and they are left in rather than
          // stripped. A methodology chapter with the argument silently removed
          // reads finished.
          markdown: supplied.method.markdown,
          // The verb is inflected as well as the noun. "1 paragraph inside it
          // are still yours" is the same slip that once put "1 independent
          // source support this" into a dossier, and it reads as carelessness
          // in a document whose whole claim is care.
          from: `Your declared paradigm and design.${
            supplied.method.gaps.length > 0
              ? ` ${supplied.method.gaps.length} ${
                  supplied.method.gaps.length === 1 ? "paragraph inside it is" : "paragraphs inside it are"
                } still yours to write.`
              : ""
          }`,
        }
      : {
          kind: "waiting",
          id: "method",
          title: "Methodology",
          says: "Declare a paradigm and a design under Method, and this is written from them.",
        },

    supplied.results
      ? { kind: "transcribed", id: "results", title: "Results", markdown: supplied.results.markdown, from: supplied.results.from }
      : {
          kind: "waiting",
          id: "results",
          title: "Results",
          says: "Run an analysis under Analyse data, and the APA results section is assembled from every finding.",
        },

    supplied.findings
      ? { kind: "transcribed", id: "findings", title: "Findings", markdown: supplied.findings.markdown, from: supplied.findings.from }
      : {
          kind: "waiting",
          id: "findings",
          title: "Findings",
          says: "Code transcripts and assemble themes under Code text, and the themes and their extracts appear here.",
        },

    yours("discussion"),
    yours("limitations"),
    yours("conclusion"),

    supplied.references
      ? {
          kind: "transcribed",
          id: "references",
          title: "References",
          markdown: supplied.references.markdown,
          from: supplied.references.count === 1
            ? "1 reference, resolved against a bibliographic provider."
            : `${supplied.references.count} references, each one resolved against a bibliographic provider.`,
        }
      : {
          kind: "waiting",
          id: "references",
          title: "References",
          says: "Add references under Literature, and they are listed here in APA form.",
        },
  ];

  return {
    title: title.trim() === "" ? "Untitled study" : title.trim(),
    sections,
    transcribed: sections.filter((section) => section.kind === "transcribed").length,
    yours: sections.filter((section) => section.kind === "yours").length,
    waiting: sections.filter((section) => section.kind === "waiting").length,
  };
}

/**
 * The document as markdown, gaps included and loud.
 *
 * The placeholders are not blank space. A document exported with silent gaps
 * is one somebody pastes into a template, skims, and submits — and the missing
 * half is missing in a way that reads as a formatting accident rather than as
 * eight sections nobody wrote.
 */
export function renderWriteUp(document: WriteUp): string {
  const lines: string[] = [
    `# ${document.title}`,
    "",
    // The two kinds of gap are counted separately, because they are different
    // problems: one is work still to do in Unpaque, the other is work nothing
    // here will ever do. A single "the other 6 are yours" was wrong in the
    // first document generated from this — one of the six was a Results
    // section waiting on an analysis nobody had run.
    `> **This is a draft skeleton, not a report.** ${document.transcribed} of ${document.sections.length} sections below are assembled from work you did in Unpaque — your declared method, your analyses, your coding, your verified references.${
      document.waiting > 0
        ? ` ${document.waiting} ${document.waiting === 1 ? "is" : "are"} waiting on work not done yet.`
        : ""
    } The remaining ${document.yours} are yours: nothing here writes an introduction, a literature argument, a discussion or a conclusion, because those are the claims you are answerable for.`,
    "",
  ];

  for (const section of document.sections) {
    if (section.kind === "transcribed") {
      // The section supplies its own heading — resultsSection() and
      // methodStatement() both open with one, and adding another produced
      // "## Results" under "## Results".
      lines.push(section.markdown.trimStart().startsWith("#")
        ? section.markdown.trim()
        : `## ${section.title}\n\n${section.markdown.trim()}`);
      lines.push("");
      lines.push(`*Assembled from: ${section.from}*`);
      lines.push("");
      continue;
    }

    lines.push(`## ${section.title}`);
    lines.push("");
    if (section.kind === "yours") {
      lines.push(`> **This section is yours to write.** ${section.says}`);
      lines.push(">");
      lines.push(`> ${section.because}`);
    } else {
      lines.push(`> **Not written yet.** ${section.says}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
