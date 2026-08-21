// The timeline engine, §9.
//
// Its whole job is one worked example in the specification. Somebody says they
// left at 20:00; a camera puts their vehicle there at 20:37; a phone record
// puts a device nearby at 20:41. The specification is explicit about what the
// system produces:
//
//     NOT: "The person lied."
//     INSTEAD: Possible explanations + additional evidence needed to
//              distinguish them.
//
// That is not a tone preference, it is the difference between an investigative
// tool and an accusation generator. So a discrepancy here is a *record type*
// that cannot exist without its explanations, and the explanations are
// generated from the shape of the conflict rather than written freehand.
//
// Note what is deliberately not omitted: "the account is inaccurate" appears in
// the list. Leaving it out would be its own dishonesty — it is a genuine
// possibility, and a system that refuses to name it while listing five others
// is steering just as much as one that leads with it. It appears alongside the
// rest, with what would distinguish it, and never first.

export const DATE_CERTAINTIES = [
  "confirmed",
  "claimed",
  "approximate",
  "conflicting",
  "unknown",
] as const;

export type DateCertainty = (typeof DATE_CERTAINTIES)[number];

/** How the time was established. Different origins fail in different ways. */
export const TIME_ORIGINS = [
  "account",        // somebody said so
  "recording",      // a camera, a call log, a machine clock
  "document",       // a dated record
  "inference",      // derived from other events
] as const;

export type TimeOrigin = (typeof TIME_ORIGINS)[number];

export interface TimelineEvent {
  id: string;
  label: string;
  /** ISO 8601. Timezone matters and is the point of several explanations below. */
  at: string;
  certainty: DateCertainty;
  origin: TimeOrigin;
  sourceId: string;
  /** For an approximate time, how wide the window is either side. */
  toleranceMinutes?: number;
}

export interface Explanation {
  summary: string;
  /** What evidence would settle it. An explanation nobody can test is noise. */
  distinguishedBy: string;
}

export interface Discrepancy {
  kind: "temporal";
  a: TimelineEvent;
  b: TimelineEvent;
  differenceMinutes: number;
  /** §10: potential until a human verifies it. Never `verified` from here. */
  status: "potential";
  explanations: Explanation[];
}

function minutesBetween(a: TimelineEvent, b: TimelineEvent): number {
  return Math.abs(new Date(a.at).getTime() - new Date(b.at).getTime()) / 60_000;
}

/**
 * The window either side of a time within which it should not be called a
 * conflict. An approximate time carries its own; anything else is exact.
 */
function tolerance(event: TimelineEvent): number {
  if (event.certainty === "approximate") return event.toleranceMinutes ?? 60;
  return 0;
}

/**
 * Explanations for two events that should coincide and do not.
 *
 * Generated from the origins of the two times rather than from their content,
 * because that is what actually determines how each can be wrong. A machine
 * clock drifts and is misconfigured; an account misremembers; a device is
 * lent, left behind, or carried by somebody else.
 */
export function explanationsFor(a: TimelineEvent, b: TimelineEvent): Explanation[] {
  const explanations: Explanation[] = [];
  const origins = new Set([a.origin, b.origin]);

  if (origins.has("recording")) {
    explanations.push({
      summary: "One record's clock is wrong, or is set to a different timezone.",
      distinguishedBy:
        "The recording system's time source, its configured offset, and whether other events it captured agree with independent records.",
    });
    explanations.push({
      summary: "The recording captures something or someone other than what it is taken to show.",
      distinguishedBy:
        "Independent identification of what appears in the recording, rather than inference from context.",
    });
  }

  if (origins.has("account")) {
    explanations.push({
      summary: "The account is approximate — a remembered time rounded or misjudged.",
      distinguishedBy:
        "Whether the account was given from memory or from a note made at the time, and how precise it claims to be.",
    });
    // Named rather than avoided. Listing five explanations and silently omitting
    // this one steers the reader as surely as leading with it.
    explanations.push({
      summary: "The account is inaccurate.",
      distinguishedBy:
        "Whether any independent record supports the account's version, and whether the difference is larger than an ordinary misrecollection would produce.",
    });
  }

  if (origins.has("recording") || origins.has("document")) {
    explanations.push({
      summary: "A device or object was present without the person it is associated with.",
      distinguishedBy:
        "Evidence tying the person to the device or object at that specific time, rather than in general.",
    });
  }

  explanations.push({
    summary: "Both are accurate and describe different moments — a departure and a return, or two separate visits.",
    distinguishedBy:
      "Continuous coverage of the location between the two times, which would show whether anybody left and came back.",
  });

  return explanations;
}

export interface DiscrepancyOptions {
  /**
   * How far apart two times must be before it is worth calling a conflict.
   * Defaults to a quarter of an hour: below that, ordinary imprecision in how
   * people report times produces noise rather than findings.
   */
  thresholdMinutes?: number;
}

/**
 * Find temporal discrepancies among events that are asserted to describe the
 * same moment.
 *
 * Callers group the events; this does not guess which events ought to
 * coincide. Inferring that from labels would manufacture conflicts between
 * things that were never claimed to be simultaneous, which is exactly the kind
 * of finding that looks impressive and is worthless.
 */
export function findTemporalDiscrepancies(
  coincident: readonly TimelineEvent[],
  options: DiscrepancyOptions = {},
): Discrepancy[] {
  const threshold = options.thresholdMinutes ?? 15;
  const discrepancies: Discrepancy[] = [];

  for (let i = 0; i < coincident.length; i += 1) {
    for (let j = i + 1; j < coincident.length; j += 1) {
      const a = coincident[i]!;
      const b = coincident[j]!;
      if (a.certainty === "unknown" || b.certainty === "unknown") continue;

      const gap = minutesBetween(a, b);
      const allowed = threshold + tolerance(a) + tolerance(b);
      if (gap <= allowed) continue;

      discrepancies.push({
        kind: "temporal",
        a,
        b,
        differenceMinutes: Math.round(gap),
        status: "potential",
        explanations: explanationsFor(a, b),
      });
    }
  }

  return discrepancies;
}

/**
 * The certainty a set of coincident events collectively warrants.
 *
 * `conflicting` outranks everything: once two records disagree, the timeline
 * cannot honestly present any single one of them as confirmed, whatever its
 * own origin claimed.
 */
export function collectiveCertainty(
  coincident: readonly TimelineEvent[],
  options: DiscrepancyOptions = {},
): DateCertainty {
  if (coincident.length === 0) return "unknown";
  if (findTemporalDiscrepancies(coincident, options).length > 0) return "conflicting";
  if (coincident.some((event) => event.certainty === "confirmed")) return "confirmed";
  if (coincident.some((event) => event.certainty === "approximate")) return "approximate";
  if (coincident.some((event) => event.certainty === "claimed")) return "claimed";
  return "unknown";
}

/** Chronological, with events of unknown time last rather than at the epoch. */
export function chronological(events: readonly TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    if (a.certainty === "unknown" && b.certainty === "unknown") return 0;
    if (a.certainty === "unknown") return 1;
    if (b.certainty === "unknown") return -1;
    return new Date(a.at).getTime() - new Date(b.at).getTime();
  });
}
