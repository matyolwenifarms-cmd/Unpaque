// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Code } from "@shared/research/qualitative/codebook.ts";
import type { Coding } from "@shared/research/qualitative/coding.ts";
import { CodeDocument } from "./CodeDocument.tsx";

const TEXT = "The cost was the first thing everyone mentioned, and nobody trusted the process.";

const CODES: Code[] = [
  {
    id: "cost",
    label: "cost",
    definition: "Where a participant speaks about what it costs them.",
    when: "Applied to any passage about money or effort.",
    notWhen: "Not applied to a passing mention with no elaboration.",
  },
  {
    id: "trust",
    label: "trust",
    definition: "Where a participant speaks about trusting the process.",
    when: "Applied to passages about confidence in the process.",
    notWhen: "Not applied to trust in an individual.",
  },
];

/**
 * Select a stretch of the rendered transcript the way a pointer does.
 *
 * jsdom has no layout, so a drag cannot be simulated - but it does have Range
 * and Selection, and what the component reads is the selection, not the drag.
 *
 * The node is found by looking for the phrase, and the code labels are
 * excluded by their *class*, deliberately not by `data-not-source`. Keying the
 * helper to the same attribute the component uses made the two move together:
 * removing the attribute broke the component and the helper identically, and
 * the test went on passing. A check that cannot fail is not evidence.
 */
function sourceNodes(): Text[] {
  const paragraph = document.querySelector("p.font-serif") as HTMLElement;
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (!(node.parentElement as HTMLElement | null)?.closest(".align-super")) {
      nodes.push(node as Text);
    }
    node = walker.nextNode();
  }
  return nodes;
}

function select(range: Range) {
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  fireEvent.mouseUp(document.querySelector("p.font-serif") as HTMLElement);
}

/** Select `phrase` where it is rendered, optionally only part of it. */
function selectPhrase(phrase: string, from = 0, to = phrase.length) {
  const node = sourceNodes().find((candidate) => candidate.textContent?.includes(phrase));
  if (!node) throw new Error(`"${phrase}" is not rendered as source text`);
  const at = node.textContent!.indexOf(phrase);
  const range = document.createRange();
  range.setStart(node, at + from);
  range.setEnd(node, at + to);
  select(range);
}

/** Select everything, the way a select-all does. */
function selectEverything() {
  const nodes = sourceNodes();
  const range = document.createRange();
  range.setStart(nodes[0]!, 0);
  range.setEnd(nodes[nodes.length - 1]!, nodes[nodes.length - 1]!.textContent!.length);
  select(range);
}

describe("coding a transcript by selecting it", () => {
  it("stores the offsets of what was selected, not a copy of it", async () => {
    const onCode = vi.fn();
    render(
      <CodeDocument
        documentId="d1"
        text={TEXT}
        codes={CODES}
        codings={[]}
        onCode={onCode}
        onUncode={vi.fn()}
      />,
    );

    selectPhrase("cost");
    expect(screen.getByText("cost", { selector: "blockquote" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "cost" }));
    expect(onCode).toHaveBeenCalledTimes(1);
    const coding = onCode.mock.calls[0]![0] as Coding;
    expect({ start: coding.start, end: coding.end }).toEqual({ start: 4, end: 8 });
    expect(TEXT.slice(coding.start, coding.end)).toBe("cost");
  });

  // The slip a mouse makes constantly. Widened before it is shown, so what was
  // approved is what is stored.
  it("widens a selection that lands mid-word, and shows the widened extract", () => {
    render(
      <CodeDocument
        documentId="d1"
        text={TEXT}
        codes={CODES}
        codings={[]}
        onCode={vi.fn()}
        onUncode={vi.fn()}
      />,
    );
    selectPhrase("cost", 1, 3);
    expect(screen.getByText("cost", { selector: "blockquote" })).toBeInTheDocument();
  });

  it("refuses to code the whole transcript, and says why", () => {
    const onCode = vi.fn();
    render(
      <CodeDocument
        documentId="d1"
        text={TEXT}
        codes={CODES}
        codings={[]}
        onCode={onCode}
        onUncode={vi.fn()}
      />,
    );
    selectEverything();
    expect(screen.getByRole("status")).toHaveTextContent(/whole document/);
    expect(onCode).not.toHaveBeenCalled();
  });

  // The offsets are read by walking the text, and the labels the surface
  // prints are not in the transcript. Without the exclusion every coding made
  // after the first lands displaced by the length of the labels above it.
  it("reads offsets correctly once a highlight and its label are on screen", async () => {
    const onCode = vi.fn();
    const existing: Coding[] = [
      { id: "g1", documentId: "d1", codeId: "cost", start: 4, end: 8 },
    ];
    render(
      <CodeDocument
        documentId="d1"
        text={TEXT}
        codes={CODES}
        codings={existing}
        onCode={onCode}
        onUncode={vi.fn()}
      />,
    );

    selectPhrase("trusted");
    expect(screen.getByText("trusted", { selector: "blockquote" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "trust" }));
    const coding = onCode.mock.calls[0]![0] as Coding;
    expect(TEXT.slice(coding.start, coding.end)).toBe("trusted");
  });

  it("shows the coded extract sliced from the source", () => {
    render(
      <CodeDocument
        documentId="d1"
        text={TEXT}
        codes={CODES}
        codings={[{ id: "g1", documentId: "d1", codeId: "cost", start: 4, end: 8, memo: "the first thing said" }]}
        onCode={vi.fn()}
        onUncode={vi.fn()}
      />,
    );
    expect(screen.getByRole("mark")).toHaveTextContent("cost");
    expect(screen.getByText("the first thing said")).toBeInTheDocument();
  });

  it("leaves another document's codings alone", () => {
    render(
      <CodeDocument
        documentId="d1"
        text={TEXT}
        codes={CODES}
        codings={[{ id: "g1", documentId: "d2", codeId: "cost", start: 4, end: 8 }]}
        onCode={vi.fn()}
        onUncode={vi.fn()}
      />,
    );
    expect(screen.queryByRole("mark")).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing coded in this document yet/)).toBeInTheDocument();
  });
});
