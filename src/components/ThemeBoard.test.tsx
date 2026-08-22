// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Code } from "@shared/research/qualitative/codebook.ts";
import type { Coding } from "@shared/research/qualitative/coding.ts";
import type { ThemeDraft } from "@shared/research/qualitative/themes.ts";
import { ThemeBoard } from "./ThemeBoard.tsx";

const ONE = "The cost was the first thing everyone mentioned, and nobody trusted the process.";
const TWO = "Cost came up again, though the process itself seemed fine to me.";

const CODES: Code[] = [
  { id: "cost", label: "cost", definition: "About cost.", when: "Cost.", notWhen: "Not a passing mention." },
  { id: "trust", label: "trust", definition: "About trust.", when: "Trust.", notWhen: "Not about a person." },
  { id: "time", label: "time", definition: "About time.", when: "Time.", notWhen: "Not about scheduling." },
];

const CODINGS: Coding[] = [
  { id: "g1", documentId: "d1", codeId: "cost", start: 4, end: 8 },
  { id: "g2", documentId: "d1", codeId: "trust", start: 60, end: 67 },
  { id: "g3", documentId: "d2", codeId: "cost", start: 0, end: 4 },
];

const DOCUMENTS = new Map([["d1", ONE], ["d2", TWO]]);

function board(drafts: ThemeDraft[], onDrafts = vi.fn()) {
  return render(
    <ThemeBoard
      codes={CODES}
      codings={CODINGS}
      documents={DOCUMENTS}
      drafts={drafts}
      onDrafts={onDrafts}
    />,
  );
}

describe("a theme is what the codings make it", () => {
  it("shows the extracts beneath the theme, sliced from the transcripts", () => {
    board([{ id: "t1", label: "Cost dominates", statement: "Money comes first.", codeIds: ["cost"] }]);
    expect(screen.getByRole("heading", { name: "Cost dominates" })).toBeInTheDocument();
    expect(screen.getByText("cost", { selector: "p.font-serif" })).toBeInTheDocument();
    expect(screen.getByText("Cost", { selector: "p.font-serif" })).toBeInTheDocument();
    expect(screen.getByText(/2 extracts across 2 documents/)).toBeInTheDocument();
  });

  // The rule the engine makes unrepresentable, reaching a screen. A heading
  // with no data beneath it is what this whole module is about.
  it("will not show a theme nothing is coded to, and says why", () => {
    board([{ id: "t1", label: "Scheduling", statement: "Nobody said this.", codeIds: ["time"] }]);
    expect(screen.queryByRole("heading", { name: "Scheduling", level: 4 })).toHaveClass("text-muted");
    expect(screen.getByText(/has no extracts and does not exist yet/)).toBeInTheDocument();
    expect(screen.queryByText("Nobody said this.")).not.toBeInTheDocument();
  });

  // A theme drawn from one participant may be the most interesting thing in
  // the study. The point is that it is not reported as though several people
  // said it.
  it("says when every extract comes from one document", () => {
    board([{ id: "t1", label: "Distrust", statement: "", codeIds: ["trust"] }]);
    expect(screen.getByText(/comes from one document/)).toBeInTheDocument();
  });

  it("names the codes no theme has gathered, and inflects for one", () => {
    board([{ id: "t1", label: "Cost dominates", statement: "", codeIds: ["cost"] }]);
    expect(screen.getByRole("heading", { name: "Coded, but under no theme" })).toBeInTheDocument();
    expect(screen.getByText(/^trust\. This code is in the data/)).toBeInTheDocument();
  });

  it("does not name a code nothing was ever coded to", () => {
    board([{ id: "t1", label: "Cost dominates", statement: "", codeIds: ["cost", "trust"] }]);
    expect(screen.queryByRole("heading", { name: "Coded, but under no theme" })).not.toBeInTheDocument();
  });

  it("will not assemble without a name and at least one code", async () => {
    board([]);
    const assemble = screen.getByRole("button", { name: "Assemble" });
    expect(assemble).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Name"), "Cost");
    expect(assemble).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "cost" }));
    expect(assemble).toBeEnabled();
  });
});
