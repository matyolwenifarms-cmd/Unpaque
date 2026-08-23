// Where a statement comes from, and how many sources really stand behind it.
//
// Section 6, and its two requirements that are still open.
//
// **"Never create an orphaned AI statement with no source relationship."** The
// specification draws the path it wants: CLAIM-031 -> SOURCE-017 -> DOCUMENT ->
// PAGE 42. Every part of that exists in the schema already; nothing rendered
// it. `provenanceOf` does, and it renders the gaps too — a claim with no
// evidence, or evidence with no locator, is shown as a broken path rather than
// as a shorter one.
//
// **"The same story appearing on 50 websites must not automatically count as
// 50 independent sources."** `independentSupport` catches only identical
// bytes, which is the easy half: a wire story republished verbatim shares a
// content hash, and a wire story with a rewritten headline does not. Lineage is
// the other half, and it is declared by the investigator rather than guessed
// at — the specification says "detect probable syndication", and a tool that
// guessed would be asserting that two reporters copied each other, which is an
// accusation.

import type { EpistemicStatus } from "./epistemic.ts";

/** How one source stands to another it derives from. */
export const LINEAGE_KINDS = ["syndication", "republication", "quotation", "translation"] as const;
export type LineageKind = (typeof LINEAGE_KINDS)[number];

export interface LineageLink {
  /** The later source. */
  sourceId: string;
  /** What it derives from. */
  derivesFromId: string;
  kind: LineageKind;
}

export interface ProvenanceSource {
  id: string;
  reference: number | null;
  title: string;
  kind: string;
}

export interface ProvenanceEvidence {
  sourceId: string;
  classification: string;
  /** Page 42, timestamp 01:42:17, paragraph 3. */
  locator?: string | null;
  excerpt?: string | null;
}

export interface ProvenanceStep {
  label: string;
  /** True where the step is missing rather than present. */
  absent: boolean;
}

/**
 * The path from a claim back to what says it, one step per line.
 *
 * A path with a gap in it is rendered with the gap named. The alternative —
 * a shorter path — reads as a complete one, and the whole point of drawing
 * it is that somebody can see where it stops.
 */
export function provenanceOf(
  claim: { reference?: number | null; statement: string; status: EpistemicStatus },
  evidence: readonly ProvenanceEvidence[],
  sources: readonly ProvenanceSource[],
): ProvenanceStep[][] {
  if (evidence.length === 0) {
    return [[
      { label: claimLabel(claim), absent: false },
      { label: "nothing on file says this", absent: true },
    ]];
  }

  return evidence.map((item) => {
    const source = sources.find((candidate) => candidate.id === item.sourceId);
    const path: ProvenanceStep[] = [{ label: claimLabel(claim), absent: false }];

    if (!source) {
      path.push({ label: "a source that is no longer in the case", absent: true });
      return path;
    }

    path.push({
      label: source.reference == null
        ? source.title
        : `SOURCE ${String(source.reference).padStart(3, "0")}`,
      absent: false,
    });
    path.push({ label: source.kind.replace(/_/g, " ").toUpperCase(), absent: false });
    path.push(
      item.locator?.trim()
        ? { label: item.locator.trim(), absent: false }
        // Not omitted. A path ending at the source says "it is in there
        // somewhere", and somewhere in a 200-page transcript is not provenance.
        : { label: "no page, timestamp or paragraph recorded", absent: true },
    );
    return path;
  });
}

function claimLabel(claim: { reference?: number | null; statement: string }): string {
  return claim.reference == null
    ? claim.statement
    : `CLAIM ${String(claim.reference).padStart(3, "0")}`;
}

export interface LineageReading {
  /** Sources that derive from nothing else in the case. */
  originals: string[];
  /** How many distinct originals the whole set traces back to. */
  independentOrigins: number;
  /** The sentence the specification asks for, or null when there is nothing to say. */
  says: string | null;
}

/**
 * How many independent origins a set of sources really has.
 *
 * Walks each source back through the lineage it was given until it reaches one
 * that derives from nothing, and counts those. A cycle — which a mistaken
 * pair of declarations can produce — stops at the first repeat rather than
 * looping, and the source is counted as its own origin, because the alternative
 * is a hang and the honest reading of "A derives from B derives from A" is that
 * nobody knows which came first.
 */
export function readLineage(
  sourceIds: readonly string[],
  links: readonly LineageLink[],
  titleOf: (id: string) => string,
): LineageReading {
  const derivesFrom = new Map(links.map((link) => [link.sourceId, link.derivesFromId]));

  const originOf = (start: string): string => {
    const seen = new Set<string>([start]);
    let current = start;
    for (;;) {
      const next = derivesFrom.get(current);
      if (next === undefined || seen.has(next)) return current;
      seen.add(next);
      current = next;
    }
  };

  const origins = new Set(sourceIds.map(originOf));
  const originals = [...origins];

  if (sourceIds.length === 0) return { originals, independentOrigins: 0, says: null };
  if (originals.length === sourceIds.length) {
    // Nothing derives from anything else. Silence rather than a reassurance:
    // no declared lineage is not the same as no lineage, and saying "these are
    // independent" would be a claim nobody made.
    return { originals, independentOrigins: originals.length, says: null };
  }

  const only = originals.length === 1 ? titleOf(originals[0]!) : null;
  return {
    originals,
    independentOrigins: originals.length,
    says: only
      ? `This appears in ${sourceIds.length} sources, all of which trace back to one original report: ${only}. It is one source, not ${sourceIds.length}.`
      : `This appears in ${sourceIds.length} sources, which trace back to ${originals.length} original reports. Most of the apparent corroboration is republication.`,
  };
}

/**
 * Independent support, counting lineage as well as identical bytes.
 *
 * The number `independentSupport` produces is a floor: it collapses sources
 * that are literally the same bytes. This collapses sources that were declared
 * to derive from one another as well, which is the case the specification
 * actually describes — the same story on fifty websites, rewritten enough
 * that no two share a hash.
 */
export function independentOrigins(
  sourceIds: readonly string[],
  links: readonly LineageLink[],
): number {
  return readLineage(sourceIds, links, (id) => id).independentOrigins;
}
