import { ASPECT_IDS, ASPECT_TITLES, type AspectId } from "./aspects.ts";
import { DEVICE_IDS } from "./devices.ts";
import { FRAMEWORK_IDS, isFrameworkId, type FrameworkId } from "./frameworks.ts";
import { parseAnnotations, describeProblem, type Annotation } from "./annotate.ts";

export type Mode = "decode" | "draft";

/**
 * The four concerns, re-exported from aspects.ts under their original names.
 *
 * They moved because annotate.ts needs them and report.ts needs annotate.ts.
 * Aliased rather than renamed across the repository: the rename is cosmetic,
 * the cycle was not, and doing both at once would bury one in the other.
 *
 * Deliberately not reusing FrameworkId values as aspect ids even though
 * "speech act" appears in both lists: an aspect is a concern the analysis must
 * cover, a framework is a citation, and a finding about `act` may perfectly
 * well cite Face Theory. Collapsing the two would quietly forbid that.
 */
export const SECTION_IDS = ASPECT_IDS;
export type SectionId = AspectId;
export const SECTION_TITLES = ASPECT_TITLES;

export interface Finding {
  /** Required. An unattributed finding is not representable. */
  framework: FrameworkId;
  /** Unpaque's own prose. Guarded — see guard.ts. */
  claim: string;
  /**
   * Verbatim spans from the analysed text, as evidence.
   *
   * NOT guarded, and that is the whole reason quotes are a separate field
   * rather than being inlined into `claim`. If the text under analysis
   * contains the word "dishonest", the report has to be able to show it. A
   * guard that scanned one blob of mixed prose-and-quotation would either
   * refuse to quote the source or have to be riddled with exceptions.
   */
  quotes: string[];
}

export interface Section {
  id: SectionId;
  /** Unpaque's own prose. Guarded. */
  summary: string;
  findings: Finding[];
}

export interface Rewrite {
  /**
   * The proposed replacement message. NOT guarded: this is a draft of the
   * user's own communication, not a claim about anybody's mind, and a user
   * whose original says "I think that was unfair" is entitled to a rewrite
   * that still says so.
   */
  text: string;
  /** Unpaque's account of what changed and why. Guarded. */
  note: string;
}

export interface DiagnosticReport {
  mode: Mode;
  /**
   * One sentence naming what the whole message does. Guarded.
   *
   * The site leads with this and it does the work a heading cannot: a reader
   * who stops after one line should still have been told the finding. It is a
   * claim about the text — "announces job losses while removing any named
   * person from the decision" — never about the sender.
   */
  verdict: string;
  /**
   * Findings anchored to positions in the submitted text, in the text's order.
   *
   * See annotate.ts. This is what the annotated view renders, and what
   * `sections` cannot express: a section groups by theme and its findings
   * carry copies of phrases, which cannot be highlighted in place.
   */
  annotations: Annotation[];
  /**
   * The four concerns, still analysed and no longer rendered as four boxes.
   *
   * Kept because they are what makes the analysis cover responsibility rather
   * than produce four remarks about tone — every annotation names the aspect
   * it speaks to. The summaries remain useful to anything that wants a
   * thematic read of the report, and cost one short field each.
   */
  sections: Section[];
  /** Present only in draft mode. */
  rewrite?: Rewrite;
}

/**
 * The tool schema handed to the model.
 *
 * `framework` is an enum rather than a string, which is the load-bearing
 * detail: a finding that cites nothing is not a policy violation to be caught
 * downstream, it is a malformed tool call the API itself rejects.
 */
export function diagnosticToolSchema(mode: Mode): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    verdict: {
      type: "string",
      description:
        "One sentence naming what the whole message does. A claim about the text, never about the sender's honesty, motive or state of mind.",
    },
    annotations: {
      type: "array",
      description:
        "Findings anchored to the submitted text. Give character offsets; the phrase itself is taken from the source.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["start", "end", "device", "framework", "aspect", "note"],
        properties: {
          // Offsets, and no field for the phrase. That absence is the whole
          // mechanism: a highlighted span is sliced from the source, so it
          // cannot be a phrase the model composed. Adding `text` here "so the
          // model can show its working" would hand back exactly the ability
          // this design removes.
          start: {
            type: "integer",
            description: "Character offset where the span begins, counting from 0.",
          },
          end: { type: "integer", description: "Character offset just past the end of the span." },
          device: {
            type: "string",
            enum: [...DEVICE_IDS],
            description: "What is being done to the sentence at this span.",
          },
          framework: {
            type: "string",
            enum: [...FRAMEWORK_IDS],
            description: "The framework licensing the reading. Required.",
          },
          aspect: {
            type: "string",
            enum: [...ASPECT_IDS],
            description: "Which of the four concerns this span speaks to.",
          },
          note: {
            type: "string",
            description:
              "Two to four sentences on what this construction does and what it leaves the reader without. Never a judgement of honesty or motive.",
          },
        },
      },
    },
    sections: {
      type: "array",
      // No minItems/maxItems. Strict tool use does not support "complex array
      // constraints" and rejects them, and the SDKs' habit of silently
      // stripping unsupported keywords would make the schema quietly weaker
      // than it reads. Nothing is lost: parseReport() already requires exactly
      // these four sections and names the missing one, which is a better error
      // than a schema violation anyway.
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "summary", "findings"],
        properties: {
          id: { type: "string", enum: [...SECTION_IDS] },
          summary: {
            type: "string",
            description:
              "One to three sentences describing the structure of the text in this respect. A statement about the text, never about a reader.",
          },
          findings: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["framework", "claim", "quotes"],
              properties: {
                framework: {
                  type: "string",
                  enum: [...FRAMEWORK_IDS],
                  description: "The framework this finding draws on. Required.",
                },
                claim: {
                  type: "string",
                  description:
                    "What the text is doing, in structural terms. No prediction of any reader's reaction, no judgement of honesty or motive.",
                },
                quotes: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Verbatim spans from the analysed text that evidence the claim. Copy exactly; do not paraphrase.",
                },
              },
            },
          },
        },
      },
    },
  };

  if (mode === "draft") {
    properties.rewrite = {
      type: "object",
      additionalProperties: false,
      required: ["text", "note"],
      properties: {
        text: { type: "string", description: "A structurally revised version of the text." },
        note: {
          type: "string",
          description: "One short paragraph on what changed structurally and why.",
        },
      },
    };
  }

  const required = ["verdict", "annotations", "sections"];
  return {
    type: "object",
    additionalProperties: false,
    required: mode === "draft" ? [...required, "rewrite"] : required,
    properties,
  };
}

export type ParseResult =
  | { ok: true; report: DiagnosticReport }
  | { ok: false; problems: string[] };

/**
 * Validate a tool-call payload into a DiagnosticReport.
 *
 * The schema above tells the model what to produce; this decides what Unpaque
 * accepts. They are separate on purpose — a schema is a request, and the only
 * thing that has ever actually stopped a malformed payload reaching a screen
 * is a parser that refuses it.
 */
export function parseReport(value: unknown, mode: Mode, source: string): ParseResult {
  const problems: string[] = [];
  const record = asRecord(value);
  if (!record) return { ok: false, problems: ["payload is not an object"] };

  // The source is a parameter because offsets cannot be checked without it.
  // That is the cost of anchoring: a parser that took only the payload could
  // confirm the shape of an annotation and nothing about whether it points at
  // anything, which is the half that matters.
  const verdict = record.verdict;
  if (typeof verdict !== "string" || verdict.trim() === "") {
    problems.push("verdict is empty");
  }

  const annotated = parseAnnotations(record.annotations, source);
  if (!annotated.ok) {
    for (const problem of annotated.problems) problems.push(describeProblem(problem));
  }

  const sections: Section[] = [];
  const rawSections = record.sections;
  if (!Array.isArray(rawSections)) {
    problems.push("sections is not an array");
  } else {
    const seen = new Set<string>();
    for (const [index, raw] of rawSections.entries()) {
      const section = asRecord(raw);
      if (!section) {
        problems.push(`sections[${index}] is not an object`);
        continue;
      }
      const id = section.id;
      if (typeof id !== "string" || !(SECTION_IDS as readonly string[]).includes(id)) {
        problems.push(`sections[${index}].id is not one of ${SECTION_IDS.join(", ")}`);
        continue;
      }
      if (seen.has(id)) {
        problems.push(`sections[${index}].id "${id}" is duplicated`);
        continue;
      }
      seen.add(id);

      const summary = section.summary;
      if (typeof summary !== "string" || summary.trim() === "") {
        problems.push(`sections[${index}].summary is empty`);
        continue;
      }

      const findings = parseFindings(section.findings, `sections[${index}]`, problems);
      sections.push({ id: id as SectionId, summary, findings });
    }

    for (const required of SECTION_IDS) {
      if (!seen.has(required)) problems.push(`section "${required}" is missing`);
    }
  }

  let rewrite: Rewrite | undefined;
  if (mode === "draft") {
    const raw = asRecord(record.rewrite);
    if (!raw) {
      problems.push("rewrite is missing in draft mode");
    } else if (typeof raw.text !== "string" || raw.text.trim() === "") {
      problems.push("rewrite.text is empty");
    } else if (typeof raw.note !== "string" || raw.note.trim() === "") {
      problems.push("rewrite.note is empty");
    } else {
      rewrite = { text: raw.text, note: raw.note };
    }
  }

  if (problems.length > 0) return { ok: false, problems };

  // Render order is ours, not the model's: a section list that arrived shuffled
  // would otherwise reorder the page.
  sections.sort((a, b) => SECTION_IDS.indexOf(a.id) - SECTION_IDS.indexOf(b.id));

  const report: DiagnosticReport = {
    mode,
    verdict: (verdict as string).trim(),
    annotations: annotated.ok ? annotated.annotations : [],
    sections,
  };
  return { ok: true, report: rewrite ? { ...report, rewrite } : report };
}

function parseFindings(value: unknown, path: string, problems: string[]): Finding[] {
  if (!Array.isArray(value)) {
    problems.push(`${path}.findings is not an array`);
    return [];
  }
  const findings: Finding[] = [];
  for (const [index, raw] of value.entries()) {
    const finding = asRecord(raw);
    if (!finding) {
      problems.push(`${path}.findings[${index}] is not an object`);
      continue;
    }
    if (!isFrameworkId(finding.framework)) {
      problems.push(
        `${path}.findings[${index}].framework "${String(finding.framework)}" is not a known framework`,
      );
      continue;
    }
    if (typeof finding.claim !== "string" || finding.claim.trim() === "") {
      problems.push(`${path}.findings[${index}].claim is empty`);
      continue;
    }
    const quotes = Array.isArray(finding.quotes)
      ? finding.quotes.filter((q): q is string => typeof q === "string")
      : [];
    findings.push({ framework: finding.framework, claim: finding.claim, quotes });
  }
  return findings;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
