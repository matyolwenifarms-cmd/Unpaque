// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { HypothesisDraft, HypothesisEvidence } from "@shared/detective/hypothesis.ts";
import type { SourceRow } from "@/lib/detective-api.ts";
import { Hypotheses } from "./Hypotheses.tsx";

const SOURCES: SourceRow[] = [
  { id: "s1", kind: "testimony", title: "Depot supervisor", retrieved_from: "https://e.org/a", retrieved_at: "2026-08-01", content_hash: null, reference: 1 },
  { id: "s2", kind: "reporting", title: "The Herald", retrieved_from: "https://e.org/b", retrieved_at: "2026-08-01", content_hash: "wire", reference: 1 },
  { id: "s3", kind: "reporting", title: "The Post", retrieved_from: "https://e.org/c", retrieved_at: "2026-08-01", content_hash: "wire", reference: 1 },
];

const draft = (id: string, statement: string, over: Partial<HypothesisDraft> = {}): HypothesisDraft => ({
  id, statement, falsifier: `Something would end ${id}.`, assumptions: ["An assumption."], ...over,
});

const PAIR = [
  draft("h1", "The driver left before 21:00."),
  draft("h2", "The driver never left."),
];

function draw(
  drafts: HypothesisDraft[] = PAIR,
  evidence: HypothesisEvidence[] = [],
  over: Partial<Parameters<typeof Hypotheses>[0]> = {},
) {
  return render(
    <Hypotheses
      drafts={drafts}
      evidence={evidence}
      sources={SOURCES}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
      onLink={vi.fn()}
      onUnlink={vi.fn()}
      {...over}
    />,
  );
}

const ev = (
  hypothesisId: string,
  classification: HypothesisEvidence["classification"],
  over: Partial<HypothesisEvidence> = {},
): HypothesisEvidence => ({
  id: `${hypothesisId}-${over.summary ?? classification}`,
  hypothesisId,
  classification,
  sourceId: over.sourceId ?? "s1",
  sourceTitle: over.sourceTitle ?? "Depot supervisor",
  summary: over.summary ?? "Says the van went out before nine.",
  ...over,
});

// "The Detective must never be forced into one theory."
describe("refusing to work on a lone theory", () => {
  it("compares nothing until a second explanation exists, and says why", () => {
    draw([draft("h1", "The driver left before 21:00.")]);
    expect(screen.getByRole("heading", { name: "Nothing to compare yet" })).toBeInTheDocument();
    expect(screen.getByText(/alternatives were never written down/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "The Skeptic" })).not.toBeInTheDocument();
  });

  it("shows the explanations once there are two", () => {
    draw();
    expect(screen.getByRole("heading", { name: "The driver left before 21:00." }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The Skeptic" })).toBeInTheDocument();
  });
});

describe("what a hypothesis must carry", () => {
  it("will not add one with nothing that would falsify it", async () => {
    const onAdd = vi.fn();
    draw(PAIR, [], { onAdd });
    await userEvent.click(screen.getByRole("button", { name: "State an explanation" }));
    await userEvent.type(screen.getByLabelText("The explanation"), "A third party did it.");

    const add = screen.getByRole("button", { name: "Add explanation" });
    expect(add).toBeDisabled();
    expect(screen.getByText(/not being tested by anything you gather for it/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/What would make you abandon it/), "A confession.");
    expect(add).toBeEnabled();
    await userEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ statement: "A third party did it.", falsifier: "A confession." }),
    );
  });

  it("shows what would end each explanation, beside it", () => {
    draw();
    expect(screen.getAllByText(/Would be abandoned if:/)).toHaveLength(2);
  });
});

describe("what it reports, and what it refuses to", () => {
  // Counts, never a score. A leaderboard of theories is the collapse into
  // truth the epistemic model exists to prevent, wearing a number.
  it("reports the record and never ranks", () => {
    draw(PAIR, [ev("h1", "supports"), ev("h1", "supports", { summary: "And again." })]);
    expect(screen.getByText(/2 supporting from 1 independent source/)).toBeInTheDocument();
    expect(screen.queryByText(/most likely|leading|score|probability/i)).not.toBeInTheDocument();
  });

  it("counts a wire story printed twice as one source", () => {
    draw(PAIR, [
      ev("h1", "supports", { sourceId: "s2", sourceTitle: "The Herald", contentHash: "wire", summary: "A" }),
      ev("h1", "supports", { sourceId: "s3", sourceTitle: "The Post", contentHash: "wire", summary: "B" }),
    ]);
    expect(screen.getByText(/2 supporting from 1 independent source;/)).toBeInTheDocument();
  });

  // The distinction a case file cannot otherwise carry.
  it("says when nothing has been looked for against an explanation", () => {
    draw(PAIR, [ev("h1", "supports")]);
    expect(screen.getAllByText(/the case file cannot tell those apart/).length).toBeGreaterThan(0);
  });

  it("names an explanation with no assumptions written down", () => {
    draw([PAIR[0]!, draft("h2", "The driver never left.", { assumptions: [] })]);
    expect(screen.getByText("No assumptions written down.")).toBeInTheDocument();
  });
});

describe("separating the explanations", () => {
  it("asks what would separate them when nothing on file does", () => {
    draw();
    expect(screen.getByText(/Nothing in the case file separates/)).toBeInTheDocument();
    expect(screen.getByText(/What could be found that only one of them survives\?/))
      .toBeInTheDocument();
  });

  it("names the record that does separate them", () => {
    const shared = { sourceId: "s1", summary: "The van was inside at 21:30." };
    draw(PAIR, [ev("h1", "contradicts", shared), ev("h2", "supports", shared)]);
    expect(screen.getByText(/1 record separates/)).toBeInTheDocument();
  });

  // The confirmation-bias trap: evidence that fits everything feels like
  // progress and moves nothing.
  it("names evidence consistent with every explanation", () => {
    const both = { sourceId: "s1", summary: "It rained that night." };
    draw(PAIR, [ev("h1", "supports", both), ev("h2", "supports", both)]);
    expect(screen.getByText(/consistent with every explanation on the table/))
      .toBeInTheDocument();
  });
});

describe("the skeptic", () => {
  it("separates what the case file answers from what only a person can", () => {
    draw();
    expect(screen.getByText(/nothing here guesses at them/)).toBeInTheDocument();
    expect(screen.getAllByText("yours to answer").length).toBeGreaterThan(0);
  });

  it("attaches no answer to a question only a person can answer", () => {
    draw();
    const question = screen.getByText("Is the source reliable?").closest("li")!;
    expect(question.textContent).toContain("yours to answer");
    expect(question.textContent).not.toContain("Nothing in the case file raises this.");
  });

  it("says plainly when a computed question raises nothing", () => {
    draw();
    expect(screen.getAllByText("Nothing in the case file raises this.").length).toBeGreaterThan(0);
  });

  it("names a source carrying more than half of an explanation", () => {
    draw(PAIR, [
      ev("h1", "supports", { summary: "One." }),
      ev("h1", "supports", { summary: "Two." }),
      ev("h1", "supports", { summary: "Three." }),
      ev("h1", "supports", { sourceId: "s2", sourceTitle: "The Herald", summary: "Four." }),
    ]);
    expect(screen.getByText(/comes from "Depot supervisor"/)).toBeInTheDocument();
  });
});
