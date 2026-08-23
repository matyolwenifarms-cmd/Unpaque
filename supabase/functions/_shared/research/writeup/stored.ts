// Reading back what was stored as jsonb.
//
// `study_findings.finding` and `study_references.reference` are jsonb, which
// Postgres will not check the shape of. That is a deliberate trade — see the
// migration — and this is where it is paid.
//
// The rule is the same one the reference pipeline follows for an identifier
// that will not resolve: what does not parse is **dropped and counted**, never
// coerced and never passed through. A half-parsed `Finding` is the worst
// possible outcome, because `Finding`'s whole purpose is that a p-value cannot
// exist without an n and an effect beside it — and an object cast to the type
// without checking would put exactly that back on the table.
//
// A row can be malformed for ordinary reasons: written by an older version of
// the app, or edited by hand in the dashboard. Neither is an error to shout
// about; both are a row to leave out and mention.

import { EFFECT_KINDS, type Effect, type Finding, type Interval } from "../analytics/result.ts";
import type { Reference } from "../reference.ts";

export interface Parsed<T> {
  /** Everything that parsed, in the order it arrived. */
  items: T[];
  /** How many did not. Reported, never swallowed. */
  dropped: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseEffect(value: unknown): Effect | null {
  if (!isObject(value)) return null;
  if (!EFFECT_KINDS.includes(value.kind as (typeof EFFECT_KINDS)[number])) return null;
  if (!isFiniteNumber(value.value)) return null;
  const magnitude = value.magnitude;
  if (
    magnitude !== null &&
    magnitude !== "negligible" && magnitude !== "small" &&
    magnitude !== "medium" && magnitude !== "large"
  ) {
    return null;
  }
  return { kind: value.kind as Effect["kind"], value: value.value, magnitude };
}

function parseInterval(value: unknown): Interval | null {
  if (!isObject(value)) return null;
  if (!isFiniteNumber(value.estimate) || !isFiniteNumber(value.lower)) return null;
  if (!isFiniteNumber(value.upper) || !isFiniteNumber(value.level)) return null;
  return {
    estimate: value.estimate, lower: value.lower, upper: value.upper, level: value.level,
  };
}

/**
 * A `Finding`, or nothing.
 *
 * Every required field is checked, including the two that make the type worth
 * having. A stored object carrying a p and no effect is not a Finding with a
 * gap in it — it is not a Finding, and admitting it would undo the one rule
 * `result.ts` exists to enforce.
 */
export function parseFinding(value: unknown): Finding | null {
  if (!isObject(value)) return null;
  if (typeof value.test !== "string" || value.test.trim() === "") return null;

  const statistic = value.statistic;
  if (!isObject(statistic) || typeof statistic.symbol !== "string") return null;
  if (!isFiniteNumber(statistic.value)) return null;

  const df = value.degreesOfFreedom;
  const degreesOfFreedom = isFiniteNumber(df)
    ? df
    : isObject(df) && isFiniteNumber(df.between) && isFiniteNumber(df.within)
      ? { between: df.between, within: df.within }
      : null;
  if (degreesOfFreedom === null) return null;

  if (!isFiniteNumber(value.p) || value.p < 0 || value.p > 1) return null;
  if (!isFiniteNumber(value.n) || value.n < 1) return null;
  if (!isFiniteNumber(value.comparisons) || value.comparisons < 1) return null;

  const effect = parseEffect(value.effect);
  const interval = parseInterval(value.interval);
  if (effect === null || interval === null) return null;

  // Never empty, by assumptions.ts. An empty list here means the row predates
  // that rule or was written by something else, and a results section that
  // silently checked nothing is the failure the rule was added to prevent.
  if (!Array.isArray(value.assumptions) || value.assumptions.length === 0) return null;
  const assumptions: Finding["assumptions"] = [];
  for (const entry of value.assumptions) {
    if (!isObject(entry) || typeof entry.name !== "string") return null;
    if (entry.status !== "met" && entry.status !== "unmet" && entry.status !== "not_assessable") {
      return null;
    }
    if (typeof entry.detail !== "string") return null;
    assumptions.push({
      name: entry.name,
      status: entry.status,
      detail: entry.detail,
      ...(typeof entry.remedy === "string" ? { remedy: entry.remedy } : {}),
    });
  }

  return {
    test: value.test,
    statistic: { symbol: statistic.symbol, value: statistic.value },
    degreesOfFreedom,
    p: value.p,
    n: value.n,
    effect,
    interval,
    comparisons: value.comparisons,
    assumptions,
  };
}

/**
 * A `Reference`, or nothing.
 *
 * Looser than `parseFinding` on purpose: most of a reference's fields are
 * optional and absent is a legitimate state throughout — a record with no year
 * is written "(n.d.)" rather than rejected. What cannot be missing is the
 * provenance, because a reference with no source is the one thing this feature
 * promises never to show.
 */
export function parseReference(value: unknown): Reference | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string" || value.id === "") return null;
  if (typeof value.source !== "string" || value.source === "") return null;
  if (typeof value.title !== "string" || value.title.trim() === "") return null;
  if (typeof value.preprint !== "boolean") return null;
  if (value.retraction !== "none" && value.retraction !== "contested" && value.retraction !== "confirmed") {
    return null;
  }
  if (!Array.isArray(value.authors)) return null;
  const authors: Reference["authors"] = [];
  for (const author of value.authors) {
    if (!isObject(author) || typeof author.name !== "string") return null;
    authors.push({ name: author.name, ...(typeof author.id === "string" ? { id: author.id } : {}) });
  }
  return { ...(value as unknown as Reference), authors };
}

/** Parse a list, keeping what is whole and counting what is not. */
export function parseAll<T>(rows: readonly unknown[], parse: (value: unknown) => T | null): Parsed<T> {
  const items: T[] = [];
  let dropped = 0;
  for (const row of rows) {
    const parsed = parse(row);
    if (parsed === null) dropped += 1;
    else items.push(parsed);
  }
  return { items, dropped };
}
