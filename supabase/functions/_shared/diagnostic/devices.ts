// The device layer: what is on the page, at the grain a reader can point at.
//
// A framework licenses a reading — Speech Act Theory, Framing Theory. A device
// is the thing in the text the reading is about: an agentless construction, a
// nominalisation, a value claim. The running site labels spans with devices,
// not frameworks, and the eight frameworks cannot express that grain: they say
// which literature the finding comes from, never what was done to the sentence.
//
// So each device names its framework rather than replacing it. Nothing here is
// a new authority — `cites` is required, and a device with no framework behind
// it would be exactly the free-floating assertion the frameworks exist to stop.
//
// ## Two labels, one device
//
// This is where Basic and Advanced live. The site's own description is that
// Basic is "accessible" and Advanced "more precise", and its worked example
// shows Advanced using terms of art unglossed: nominalisation, agentless
// framing, strategic vagueness. The layout does not change between the two and
// the analysis does not change — only the words for it do.
//
// Holding both labels on one device rather than running two vocabularies is
// deliberate. Two lists drift, and the drift is invisible: a device added to
// Advanced and forgotten in Basic just silently stops appearing for the reader
// who needs the plain words most. Here it cannot be added to one and not the
// other, because it is one entry with two fields.
//
// British spelling throughout, including `nominalisation`. The deployed site
// has the American form; the rest of this repository is British and a product
// that spells one term in each convention looks unproofed.

import { FRAMEWORK_IDS, type FrameworkId } from "./frameworks.ts";

export const DEVICE_IDS = [
  "agentless_framing",
  "nominalisation",
  "sentiment_softener",
  "value_claim",
  "strategic_vagueness",
  "hedge",
  "euphemism",
  "passive_attribution",
  "presupposition",
  "unbounded_commitment",
  "false_agency",
  "minimiser",
] as const;

export type DeviceId = (typeof DEVICE_IDS)[number];

export interface Device {
  readonly id: DeviceId;
  /** The term of art. Advanced mode, unglossed, as the site does it. */
  readonly advanced: string;
  /**
   * The same device without the term of art. Basic mode.
   *
   * Not a definition of the Advanced word — a reader who needs "nominalisation"
   * explained is not helped by a label that explains it, they are helped by a
   * label that never used it. So these name the move in ordinary words.
   */
  readonly basic: string;
  /** What the device does, one sentence, for a tooltip or a glossary. */
  readonly gloss: string;
  /** Required. A device is a way of seeing, not a source of authority. */
  readonly cites: FrameworkId;
}

export const DEVICES: Record<DeviceId, Device> = {
  agentless_framing: {
    id: "agentless_framing",
    advanced: "agentless framing",
    basic: "no one named",
    gloss: "Reports an outcome without saying who brought it about.",
    cites: "critical_discourse",
  },
  nominalisation: {
    id: "nominalisation",
    advanced: "nominalisation",
    basic: "action turned into a thing",
    gloss: "Converts a verb into a noun, which drops both the actor and the moment it happened.",
    cites: "critical_discourse",
  },
  sentiment_softener: {
    id: "sentiment_softener",
    advanced: "sentiment softener",
    basic: "feeling without a source",
    gloss: "Registers an emotion about the news without attaching it to anyone who decided it.",
    cites: "face",
  },
  value_claim: {
    id: "value_claim",
    advanced: "value claim",
    basic: "stated, not shown",
    gloss: "Asserts a commitment or a virtue without evidence that it was acted on.",
    cites: "image_repair",
  },
  strategic_vagueness: {
    id: "strategic_vagueness",
    advanced: "strategic vagueness",
    basic: "deliberately unclear",
    gloss: "Leaves a term open so that more than one reader can be satisfied by it.",
    cites: "strategic_ambiguity",
  },
  hedge: {
    id: "hedge",
    advanced: "hedge",
    basic: "leaves a way out",
    gloss: "Qualifies a claim so that it cannot later be held to have been made.",
    cites: "strategic_ambiguity",
  },
  euphemism: {
    id: "euphemism",
    advanced: "euphemism",
    basic: "softer word for a hard thing",
    gloss: "Substitutes a milder term for the one that names what happened.",
    cites: "framing",
  },
  passive_attribution: {
    id: "passive_attribution",
    advanced: "passive attribution",
    basic: "credit and blame moved",
    gloss: "Places a cause outside the speaker, or a success inside, without argument.",
    cites: "attribution",
  },
  presupposition: {
    id: "presupposition",
    advanced: "presupposition",
    basic: "treated as already settled",
    gloss: "Builds a contestable claim into the sentence as though it were agreed.",
    cites: "informal_logic",
  },
  unbounded_commitment: {
    id: "unbounded_commitment",
    advanced: "unbounded commitment",
    basic: "a promise with no date",
    gloss: "Promises an action with no time, quantity or threshold attached to it.",
    cites: "strategic_ambiguity",
  },
  false_agency: {
    id: "false_agency",
    advanced: "false agency",
    basic: "something else blamed",
    gloss: "Gives the decision to a circumstance or a process rather than to a person.",
    cites: "attribution",
  },
  minimiser: {
    id: "minimiser",
    advanced: "minimiser",
    basic: "made to sound smaller",
    gloss: "Uses scale or quantity words that make the effect sound smaller than it is.",
    cites: "framing",
  },
};

/** How much technical vocabulary the reader has asked for. */
export const DEPTHS = ["basic", "advanced"] as const;
export type Depth = (typeof DEPTHS)[number];

/**
 * The label to print beside a span.
 *
 * The whole Basic/Advanced switch, in one function. Everything else about a
 * report is identical between the two — same spans, same order, same
 * explanations — which is what makes this a lookup rather than a second
 * pipeline.
 */
export function deviceLabel(id: DeviceId, depth: Depth): string {
  return depth === "advanced" ? DEVICES[id].advanced : DEVICES[id].basic;
}

export function isDeviceId(value: unknown): value is DeviceId {
  return typeof value === "string" && (DEVICE_IDS as readonly string[]).includes(value);
}

/** Every framework the device list can reach. Used by the drift test. */
export const CITED_FRAMEWORKS: readonly FrameworkId[] = FRAMEWORK_IDS.filter((framework) =>
  DEVICE_IDS.some((device) => DEVICES[device].cites === framework),
);
