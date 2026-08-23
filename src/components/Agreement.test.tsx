// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Code } from "@shared/research/qualitative/codebook.ts";
import type { Coding } from "@shared/research/qualitative/coding.ts";
import { Agreement } from "./Agreement.tsx";

const DOC =
  "The cost was the first thing everyone mentioned.\n\n" +
  "Nobody trusted the process at all.\n\n" +
  "The waiting was worse than the money.\n\n" +
  "None of that bothered me.";

const CODES: Code[] = [
  { id: "cost", label: "cost", definition: "About cost.", when: "Money.", notWhen: "Not in passing." },
];

const CODINGS: Coding[] = [
  { id: "g1", documentId: "d1", codeId: "cost", start: 4, end: 8, coderId: "amy" },
  { id: "g2", documentId: "d1", codeId: "cost", start: 0, end: 12, coderId: "ben" },
  { id: "g3", documentId: "d1", codeId: "cost", start: 90, end: 100, coderId: "amy" },
];

const CODERS = [
  { id: "amy", name: "amy@example.org" },
  { id: "ben", name: "ben@example.org" },
];

function draw(over: Partial<Parameters<typeof Agreement>[0]> = {}) {
  return render(
    <Agreement
      codes={CODES}
      codings={CODINGS}
      documents={new Map([["d1", DOC]])}
      coders={CODERS}
      blind={false}
      isOwner
      onUnblind={vi.fn()}
      {...over}
    />,
  );
}

// The methodological rule the whole feature turns on. A second coder who can
// see the first coder's highlights reaches the same passages because they were
// shown them, and the figure that comes out measures nothing.
describe("while the study is blind", () => {
  it("computes nothing, and says why", () => {
    draw({ blind: true });
    expect(screen.getByRole("heading", { name: /still blind/ })).toBeInTheDocument();
    expect(screen.getByText(/measures nothing/)).toBeInTheDocument();
    expect(screen.queryByText(/Cohen/)).not.toBeInTheDocument();
  });

  it("warns the owner that unblinding cannot be undone", async () => {
    const onUnblind = vi.fn();
    draw({ blind: true, onUnblind });
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Unblind, and compare/ }));
    expect(onUnblind).toHaveBeenCalled();
  });

  it("offers a second coder no way to unblind it themselves", () => {
    draw({ blind: true, isOwner: false });
    expect(screen.queryByRole("button", { name: /Unblind/ })).not.toBeInTheDocument();
    expect(screen.getByText(/owner of this study unblinds it/)).toBeInTheDocument();
  });
});

describe("once it is unblinded", () => {
  it("reports the kappa, its interval and the observed agreement together", () => {
    draw();
    expect(screen.getByText(/Cohen's κ = /)).toBeInTheDocument();
    expect(screen.getByText(/95% CI \[/)).toBeInTheDocument();
    expect(screen.getByText(/observed agreement/)).toBeInTheDocument();
  });

  it("shows the four cells the figure is computed from", () => {
    draw();
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    // Both coded the first paragraph; Amy alone coded the third.
    expect(screen.getByRole("rowheader", { name: /amy@example.org applied/ })).toBeInTheDocument();
  });

  // A convention, not a standard, and its author called the cut-offs
  // arbitrary. Attribution is what makes the caveat travel with the label.
  it("attributes the conventional label rather than asserting it", () => {
    draw();
    expect(screen.getByText(/Landis and Koch/)).toBeInTheDocument();
    expect(screen.getByText(/convention rather than a standard/)).toBeInTheDocument();
  });

  it("says which division the numbers depend on", () => {
    draw();
    expect(screen.getByLabelText("Unit of analysis")).toHaveValue("paragraph");
    expect(screen.getByText(/Split on blank lines/)).toBeInTheDocument();
  });

  it("refuses when only one person has coded", () => {
    draw({ coders: [CODERS[0]!] });
    expect(screen.getByRole("heading", { name: /Only one person has coded/ })).toBeInTheDocument();
    expect(screen.queryByText(/Cohen/)).not.toBeInTheDocument();
  });

  // The degenerate case that must never be printed as a kappa of zero.
  it("explains an undefined kappa instead of printing a number", () => {
    draw({
      codings: [
        { id: "g1", documentId: "d1", codeId: "cost", start: 0, end: DOC.length, coderId: "amy" },
        { id: "g2", documentId: "d1", codeId: "cost", start: 0, end: DOC.length, coderId: "ben" },
      ],
    });
    expect(screen.getByText(/Both coders applied this code to every unit/)).toBeInTheDocument();
    expect(screen.queryByText(/Cohen's κ/)).not.toBeInTheDocument();
  });
});
