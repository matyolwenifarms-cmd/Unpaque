// The four concerns an analysis must cover.
//
// Their own module rather than living in report.ts, because annotate.ts needs
// them and report.ts needs annotate.ts. Left where they were, that is a cycle —
// and a cycle between two modules that both initialise top-level constants is
// the kind of thing that works under vitest, works under Deno, and then throws
// `Cannot access before initialisation` in the bundler, at runtime, in
// production, for one import order out of two.
//
// They were `SECTION_IDS` when the report was four sections on a page. The
// page is now one annotated pass over the text, so they are no longer places
// to render — they are the four things the analysis has to have looked for,
// carried on each annotation as its `aspect`. The names are unchanged so the
// prompt, the tests and the specification citations still line up.

export const ASPECT_IDS = ["act", "responsibility", "framing", "ambiguity"] as const;
export type AspectId = (typeof ASPECT_IDS)[number];

export const ASPECT_TITLES: Readonly<Record<AspectId, string>> = {
  act: "What this is doing",
  responsibility: "Where responsibility sits",
  framing: "What is foregrounded, what is left out",
  ambiguity: "Where it stays vague",
};

export function isAspectId(value: unknown): value is AspectId {
  return typeof value === "string" && (ASPECT_IDS as readonly string[]).includes(value);
}
