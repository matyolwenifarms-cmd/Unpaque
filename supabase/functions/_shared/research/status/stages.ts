// The stages of the Research feature, in the order the work tends to happen.
//
// Here rather than in the page, so that the status panel can name a stage
// without importing a React component and without a second list to keep in
// step. A `ResearchStage` that names nothing on screen would be a link to
// nowhere, and one list is the only version where that cannot happen.

export const RESEARCH_STAGES = [
  { id: "proposal", name: "Proposal", blurb: "Check its references and its design" },
  { id: "literature", name: "Literature", blurb: "Find and verify references" },
  { id: "papers", name: "Papers", blurb: "Hold the papers, and set them against each other" },
  { id: "screening", name: "Screening", blurb: "Decide what is in the review, and count the flow" },
  { id: "method", name: "Method", blurb: "Declare the paradigm and approach" },
  { id: "analyse", name: "Analyse data", blurb: "Upload a file and run a test" },
  { id: "code", name: "Code text", blurb: "Code transcripts and build themes" },
  { id: "writeup", name: "Write up", blurb: "Assemble what is written, and what is not" },
] as const;

export type ResearchStage = (typeof RESEARCH_STAGES)[number]["id"];

export function stageName(stage: ResearchStage): string {
  return RESEARCH_STAGES.find((one) => one.id === stage)!.name;
}
