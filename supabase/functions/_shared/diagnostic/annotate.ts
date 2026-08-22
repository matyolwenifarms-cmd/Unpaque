// The annotated source: findings anchored to positions in the text, not copies
// of it.
//
// The running site presents one pass over the submitted text in the text's own
// order, with the diagnosed phrases highlighted in place and a device label
// beside each. `quotes: string[]` cannot express that — a list of strings says
// what was quoted and never where, so it cannot be highlighted, and a string
// that drifts by a word from the source is indistinguishable from one that
// did not.
//
// So an annotation is a pair of offsets. The model returns positions and the
// server does the slicing, which is the same mechanism the passage engine uses
// and for the same reason: **the tool schema has no field a phrase could be
// written into**, so a highlighted span is necessarily from the source. There
// is no prompt to obey and no guard to run. It is not that fabrication is
// forbidden; it is that fabrication is not representable.
//
// The cost of that choice is the failure this module is mostly about. A model
// that miscounts by four characters cannot invent a phrase, but it can point
// at the wrong one — and a wrong highlight is quiet, because it looks exactly
// like a right one. Everything below exists to make that loud instead:
// bounds are checked, overlaps are refused, spans that land on whitespace or
// mid-word are refused, and `annotationsAreFaithful` re-derives every slice
// before display.

import { isDeviceId, type DeviceId } from "./devices.ts";
import { isFrameworkId, type FrameworkId } from "./frameworks.ts";
import { ASPECT_IDS, isAspectId, type AspectId } from "./aspects.ts";

/** Below this a span is a fragment, not a phrase somebody can read. */
export const MIN_SPAN_CHARS = 2;

/**
 * A highlight cannot be most of the message.
 *
 * Not a formatting rule. A span covering the whole text says "all of this is
 * doing the thing", which is the one claim an annotation cannot support: the
 * reader is being shown a phrase precisely so they can see the phrase doing it.
 */
export const MAX_SPAN_FRACTION = 0.5;

export interface Annotation {
  /** Offsets into the submitted text, exactly as it was submitted. */
  start: number;
  end: number;
  /** What was done to the sentence. Carries both registers — see devices.ts. */
  device: DeviceId;
  /** Which literature licenses the reading. */
  framework: FrameworkId;
  /**
   * Which of the four concerns this speaks to.
   *
   * The site shows no section headings, and this is what survives of them.
   * Dropping the four concepts entirely would drop the only thing that made
   * the analysis cover responsibility rather than four remarks about tone —
   * so the aspect travels on the annotation, shaping what is looked for
   * without putting four boxes back on the page.
   */
  aspect: AspectId;
  /** Unpaque's prose about this span. Guarded — see guard.ts. */
  note: string;
}

export type AnnotationProblem =
  | { kind: "not_an_object"; at: number }
  | { kind: "bad_offset"; at: number; detail: string }
  | { kind: "out_of_bounds"; at: number; detail: string }
  | { kind: "too_short"; at: number }
  | { kind: "too_long"; at: number; detail: string }
  | { kind: "blank"; at: number }
  | { kind: "mid_word"; at: number; detail: string }
  | { kind: "overlap"; at: number; detail: string }
  | { kind: "unknown_device"; at: number; detail: string }
  | { kind: "unknown_framework"; at: number; detail: string }
  | { kind: "unknown_aspect"; at: number; detail: string }
  | { kind: "empty_note"; at: number };

export function describeProblem(problem: AnnotationProblem): string {
  const at = `annotations[${problem.at}]`;
  switch (problem.kind) {
    case "not_an_object": return `${at} is not an object`;
    case "bad_offset": return `${at} has a non-integer or negative offset: ${problem.detail}`;
    case "out_of_bounds": return `${at} points outside the text: ${problem.detail}`;
    case "too_short": return `${at} spans fewer than ${MIN_SPAN_CHARS} characters`;
    case "too_long": return `${at} spans ${problem.detail} of the text; a highlight cannot be most of the message`;
    case "blank": return `${at} spans only whitespace`;
    case "mid_word": return `${at} starts or ends inside a word: ${problem.detail}`;
    case "overlap": return `${at} overlaps the previous annotation: ${problem.detail}`;
    case "unknown_device": return `${at}.device is not a known device: ${problem.detail}`;
    case "unknown_framework": return `${at}.framework is not a known framework: ${problem.detail}`;
    case "unknown_aspect": return `${at}.aspect is not one of ${ASPECT_IDS.join(", ")}: ${problem.detail}`;
    case "empty_note": return `${at}.note is empty`;
  }
}

export type AnnotationResult =
  | { ok: true; annotations: Annotation[] }
  | { ok: false; problems: AnnotationProblem[] };

/**
 * Validate raw annotations against the text they claim to point into.
 *
 * Sorted before overlap checking rather than requiring sorted input: the order
 * a model happens to emit is not a claim about anything, and refusing a correct
 * set for arriving out of order would cost a retry for nothing. Overlap is
 * refused, because two highlights over the same characters cannot both be
 * rendered and picking one silently would hide a finding.
 */
export function parseAnnotations(value: unknown, text: string): AnnotationResult {
  if (!Array.isArray(value)) {
    return { ok: false, problems: [{ kind: "not_an_object", at: 0 }] };
  }

  const problems: AnnotationProblem[] = [];
  const parsed: Annotation[] = [];

  for (const [at, raw] of value.entries()) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      problems.push({ kind: "not_an_object", at });
      continue;
    }
    const record = raw as Record<string, unknown>;
    const { start, end } = record;

    if (!Number.isInteger(start) || !Number.isInteger(end) || (start as number) < 0) {
      problems.push({ kind: "bad_offset", at, detail: `${String(start)}–${String(end)}` });
      continue;
    }
    const from = start as number;
    const to = end as number;
    if (to <= from || to > text.length) {
      problems.push({ kind: "out_of_bounds", at, detail: `${from}–${to} of ${text.length}` });
      continue;
    }

    const slice = text.slice(from, to);
    if (slice.trim() === "") {
      problems.push({ kind: "blank", at });
      continue;
    }
    if (slice.trim().length < MIN_SPAN_CHARS) {
      problems.push({ kind: "too_short", at });
      continue;
    }
    if (to - from > text.length * MAX_SPAN_FRACTION) {
      problems.push({
        kind: "too_long",
        at,
        detail: `${Math.round(((to - from) / text.length) * 100)}%`,
      });
      continue;
    }

    // An off-by-a-few offset lands mid-word, and the highlight it produces
    // reads as a typo rather than as a bug. Cheap to catch, and the only
    // signal available that the count was wrong.
    const before = from > 0 ? text[from - 1] : " ";
    const after = to < text.length ? text[to] : " ";
    if (isWordChar(before) && isWordChar(text[from])) {
      problems.push({ kind: "mid_word", at, detail: `starts inside "${wordAround(text, from)}"` });
      continue;
    }
    if (isWordChar(after) && isWordChar(text[to - 1])) {
      problems.push({ kind: "mid_word", at, detail: `ends inside "${wordAround(text, to)}"` });
      continue;
    }

    const { device, framework, aspect, note } = record;
    if (!isDeviceId(device)) {
      problems.push({ kind: "unknown_device", at, detail: String(device) });
      continue;
    }
    if (!isFrameworkId(framework)) {
      problems.push({ kind: "unknown_framework", at, detail: String(framework) });
      continue;
    }
    if (!isAspectId(aspect)) {
      problems.push({ kind: "unknown_aspect", at, detail: String(aspect) });
      continue;
    }
    if (typeof note !== "string" || note.trim() === "") {
      problems.push({ kind: "empty_note", at });
      continue;
    }

    parsed.push({
      start: from,
      end: to,
      device,
      framework,
      aspect,
      note: note.trim(),
    });
  }

  parsed.sort((a, b) => a.start - b.start);
  for (let index = 1; index < parsed.length; index += 1) {
    const previous = parsed[index - 1]!;
    const current = parsed[index]!;
    if (current.start < previous.end) {
      problems.push({
        kind: "overlap",
        at: index,
        detail: `${current.start}–${current.end} against ${previous.start}–${previous.end}`,
      });
    }
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, annotations: parsed };
}

function isWordChar(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}]/u.test(character);
}

function wordAround(text: string, at: number): string {
  let from = at;
  let to = at;
  while (from > 0 && isWordChar(text[from - 1])) from -= 1;
  while (to < text.length && isWordChar(text[to])) to += 1;
  return text.slice(from, to);
}

export interface Segment {
  text: string;
  /** Absent for the untouched prose between highlights. */
  annotation?: Annotation;
}

/**
 * The whole text, split into what is highlighted and what is not.
 *
 * Returns the *entire* source, not just the highlighted parts. That is the
 * point of the annotated view: a reader sees their own message with the
 * findings sitting inside it, so the parts nobody flagged have to be there too.
 * Concatenating every segment's text reconstructs the input exactly, and there
 * is a test that says so.
 */
export function segments(text: string, annotations: readonly Annotation[]): Segment[] {
  const ordered = [...annotations].sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let cursor = 0;

  for (const annotation of ordered) {
    if (annotation.start > cursor) out.push({ text: text.slice(cursor, annotation.start) });
    out.push({ text: text.slice(annotation.start, annotation.end), annotation });
    cursor = annotation.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });

  return out;
}

/**
 * Re-derive every span from the source before display.
 *
 * The design makes a fabricated highlight unrepresentable, and this is the
 * difference between that being an argument and being a fact about the object
 * in hand. It is two comparisons; run it anyway.
 */
export function annotationsAreFaithful(text: string, annotations: readonly Annotation[]): boolean {
  return annotations.every(
    (annotation) =>
      annotation.start >= 0 &&
      annotation.end <= text.length &&
      annotation.start < annotation.end &&
      text.slice(annotation.start, annotation.end).trim() !== "",
  );
}
