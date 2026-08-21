// The eight frameworks Unpaque is allowed to reason from.
//
// This is not a documentation list — it is the closed set that every finding
// must name. `FrameworkId` is the union, the structured-output schema pins the
// enum to exactly these ids, and `guard.ts` treats an unrecognised id as a
// hard failure. The effect is that "every finding is theory-attributed" stops
// being an instruction in a prompt (which a model will eventually ignore) and
// becomes a shape the response either has or does not have.
//
// The rejected alternative was a free-text `framework: string` with the prompt
// asking nicely for one of the eight. That works until the model writes
// "general communication principles", which is precisely the generic-tone-score
// output the product exists to not be.

export const FRAMEWORK_IDS = [
  "speech_act",
  "image_repair",
  "framing",
  "strategic_ambiguity",
  "attribution",
  "critical_discourse",
  "face",
  "informal_logic",
] as const;

export type FrameworkId = (typeof FRAMEWORK_IDS)[number];

export interface Framework {
  id: FrameworkId;
  /** Shown as the attribution label on a finding card. */
  name: string;
  /** The tradition, so a sceptical user can go and read the source. */
  tradition: string;
  /**
   * One or two sentences of plain language for a non-academic reader. Phase 2
   * renders this under "why this reads the way it does"; it lives here from the
   * start so the data model already carries what that screen needs.
   */
  gloss: string;
}

export const FRAMEWORKS: Readonly<Record<FrameworkId, Framework>> = {
  speech_act: {
    id: "speech_act",
    name: "Speech Act Theory",
    tradition: "Austin (1962); Searle (1969)",
    gloss:
      "Separates what a sentence says from what it does. “It would be good to have this by Friday” is shaped like an observation and works like an instruction; the gap between the two is where a lot of workplace confusion lives.",
  },
  image_repair: {
    id: "image_repair",
    name: "Image Repair Theory",
    tradition: "Benoit (1995)",
    gloss:
      "Catalogues the moves available when someone's standing is under threat — denial, shifting blame, reducing offensiveness, corrective action, mortification. Naming the move is descriptive; it says nothing about whether the move is warranted.",
  },
  framing: {
    id: "framing",
    name: "Framing Theory",
    tradition: "Goffman (1974); Entman (1993)",
    gloss:
      "Every account foregrounds some things and leaves others out. Framing looks at what has been made salient and what a reader would have to already know to notice the gap.",
  },
  strategic_ambiguity: {
    id: "strategic_ambiguity",
    name: "Strategic Ambiguity",
    tradition: "Eisenberg (1984)",
    gloss:
      "Vagueness is sometimes the point. A phrase loose enough to satisfy two audiences at once, or to avoid committing to a date, is doing work — and that work can be entirely legitimate.",
  },
  attribution: {
    id: "attribution",
    name: "Attribution Theory",
    tradition: "Heider (1958); Kelley (1967); Weiner (1985)",
    gloss:
      "Tracks where a text puts the cause of an event: in a person, in someone else, or in circumstance. “Mistakes were made” attributes to nobody at all, which is a choice the grammar makes visible.",
  },
  critical_discourse: {
    id: "critical_discourse",
    name: "Critical Discourse Analysis",
    tradition: "Fairclough (1989); van Dijk (1993)",
    gloss:
      "Reads language for the positions it assumes — who is entitled to ask, who is expected to explain, whose account is treated as the default.",
  },
  face: {
    id: "face",
    name: "Face Theory",
    tradition: "Goffman (1955); Brown & Levinson (1987)",
    gloss:
      "Face is the social standing a person claims in an exchange. Hedges, apologies and indirectness are usually face-work: protecting the reader's standing, the writer's, or both at once.",
  },
  informal_logic: {
    id: "informal_logic",
    name: "Informal Logic",
    tradition: "Toulmin (1958); Walton (1989)",
    gloss:
      "The argument underneath the wording: what is being claimed, what is offered as support, and what has been assumed without being stated.",
  },
};

export function isFrameworkId(value: unknown): value is FrameworkId {
  return typeof value === "string" && (FRAMEWORK_IDS as readonly string[]).includes(value);
}
