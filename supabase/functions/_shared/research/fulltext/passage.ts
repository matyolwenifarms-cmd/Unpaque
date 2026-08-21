import type { FullTextVersion } from "../reference.ts";
import { toSourceRange, type NormalisedText } from "./normalise.ts";

// Selecting the passage that shows why a reference bears on a study.
//
// The model returns offsets. It does not return text. That is the whole design:
// `passage.text` is assigned exactly once in this file, from
// `doc.text.slice()`, so a quotation that is not in the source cannot be
// produced by any code path. A model that wanted to invent a supporting
// sentence has no field to put it in.
//
// What the model does write is `why` — the sentence explaining relevance to
// this particular study. That is generated prose and is treated as such.

/**
 * Short enough to be a quotation rather than a reproduction. A passage is
 * evidence that a reference is relevant; it is not a way to read the paper
 * without visiting it, and the distinction matters both for the reader and for
 * what may legitimately be displayed from a work under copyright.
 */
export const MAX_PASSAGE_CHARS = 1200;

/** Below this there is not enough context for a reader to judge relevance. */
export const MIN_PASSAGE_CHARS = 40;

export interface PassageRequest {
  /** Must be a reference already retrieved this session. */
  referenceId: string;
  start: number;
  end: number;
  /** Generated prose: why this bears on the study. */
  why: string;
}

export interface Passage {
  referenceId: string;
  /** Sliced from the source. Never written by a model. */
  text: string;
  why: string;
  /** Where to land the reader in the retrieved document. */
  sourceStart: number;
  sourceEnd: number;
  version: FullTextVersion;
  /** What must be said about quoting this copy. Null when it is the record. */
  caveat: string | null;
}

export type PassageOutcome =
  | { ok: true; passage: Passage }
  | { ok: false; reason: PassageRefusal; detail?: string };

export type PassageRefusal =
  | "unknown_reference"
  | "no_full_text"
  | "out_of_bounds"
  | "too_short"
  | "too_long"
  | "empty_rationale";

export interface PassageContext {
  /** Ids retrieved this session. Anything else is a citation of nothing. */
  knownReferenceIds: ReadonlySet<string>;
  /** The retrieved text, by reference id. Absent means metadata_only. */
  documents: ReadonlyMap<string, NormalisedText>;
  versions: ReadonlyMap<string, FullTextVersion>;
  caveats: ReadonlyMap<string, string | null>;
}

/**
 * Widen a span to whole sentences.
 *
 * A model asked for the relevant span routinely returns one clipped mid-clause.
 * Displayed as a quotation that reads as sloppiness about the source, and a
 * reader cannot tell whether the truncation changed the meaning. Widening is
 * always safe in a way that narrowing is not: it can only add context the
 * author wrote.
 */
export function expandToSentence(text: string, start: number, end: number): { start: number; end: number } {
  let from = start;
  while (from > 0) {
    const prev = text[from - 1]!;
    if (/[.!?]/.test(prev) && /\s/.test(text[from] ?? " ")) break;
    from -= 1;
  }
  while (from < text.length && /\s/.test(text[from]!)) from += 1;

  let to = end;
  while (to < text.length && !/[.!?]/.test(text[to - 1] ?? "")) to += 1;
  // Carry closing punctuation and quotation marks that belong to the sentence.
  while (to < text.length && /["')\]]/.test(text[to]!)) to += 1;

  return { start: Math.min(from, start), end: Math.max(to, end) };
}

export function selectPassage(request: PassageRequest, context: PassageContext): PassageOutcome {
  if (!context.knownReferenceIds.has(request.referenceId)) {
    // A citation of something never retrieved is the failure this whole
    // feature exists to prevent, so it is refused before anything else.
    return { ok: false, reason: "unknown_reference", detail: request.referenceId };
  }

  const doc = context.documents.get(request.referenceId);
  if (!doc) {
    // metadata_only. The reference still lists; there is simply nothing to
    // quote, and generating something would be the exact fabrication the
    // design refuses.
    return { ok: false, reason: "no_full_text", detail: request.referenceId };
  }

  if (typeof request.why !== "string" || request.why.trim() === "") {
    return { ok: false, reason: "empty_rationale" };
  }

  const raw = toSourceRange(doc, request.start, request.end);
  if (!raw) return { ok: false, reason: "out_of_bounds", detail: `${request.start}-${request.end}` };

  const widened = expandToSentence(doc.text, request.start, request.end);
  const text = doc.text.slice(widened.start, widened.end).trim();

  if (text.length < MIN_PASSAGE_CHARS) return { ok: false, reason: "too_short" };
  if (text.length > MAX_PASSAGE_CHARS) return { ok: false, reason: "too_long" };

  const range = toSourceRange(doc, widened.start, widened.end);
  if (!range) return { ok: false, reason: "out_of_bounds" };

  return {
    ok: true,
    passage: {
      referenceId: request.referenceId,
      text,
      why: request.why.trim(),
      sourceStart: range.start,
      sourceEnd: range.end,
      version: context.versions.get(request.referenceId) ?? "unknown",
      caveat: context.caveats.get(request.referenceId) ?? null,
    },
  };
}

/**
 * The check that the guarantee actually held.
 *
 * Cheap, and worth running on everything before display: it is the difference
 * between "this design makes fabrication impossible" as an argument and as a
 * fact about the object in hand. Whitespace is normalised on both sides because
 * the passage is trimmed.
 */
export function passageIsVerbatim(passage: Passage, doc: NormalisedText): boolean {
  const slice = doc.source.slice(passage.sourceStart, passage.sourceEnd);
  const flatten = (value: string) => value.replace(/\s+/g, " ").trim();
  return flatten(slice).includes(flatten(passage.text));
}

/**
 * The tool the model fills in to nominate a passage.
 *
 * Two things are load-bearing and both are absences as much as presences.
 *
 * `reference_id` is an enum of the ids actually retrieved this session, so
 * citing something that was never found is a malformed tool call the API
 * rejects rather than a mistake for something downstream to notice. This is
 * the same mechanism as Unpack's framework attribution, third application.
 *
 * And there is **no field for the quotation**. The model says where; the server
 * slices. A model inclined to write a supporting sentence has nowhere to put
 * it, which is a stronger guarantee than any instruction telling it not to.
 *
 * There are deliberately no numeric bounds on `start` and `end`: strict tool
 * use rejects `minimum`/`maximum` as unsupported, and the SDKs strip such
 * keywords silently, which would leave a schema claiming a constraint the API
 * never enforced. `selectPassage` bounds them instead, against the actual
 * document, which it can do and a schema cannot.
 */
export function passageToolSchema(referenceIds: readonly string[]): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["passages"],
    properties: {
      passages: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["reference_id", "start", "end", "why"],
          properties: {
            reference_id: {
              type: "string",
              enum: [...referenceIds],
              description: "A reference retrieved in this session. No other value is valid.",
            },
            start: {
              type: "integer",
              description: "Character offset into the supplied text where the passage begins.",
            },
            end: {
              type: "integer",
              description: "Character offset where it ends. Must be greater than start.",
            },
            why: {
              type: "string",
              description:
                "One or two sentences on how this passage bears on the study. Describe the connection; do not restate the passage.",
            },
          },
        },
      },
    },
  };
}
