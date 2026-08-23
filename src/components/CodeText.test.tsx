// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const loadStudy = vi.fn();
const addDocument = vi.fn();
const addCode = vi.fn();
const applyCoding = vi.fn();
const setCodingOrder = vi.fn();
const listCoders = vi.fn();
const inviteCoder = vi.fn();
vi.mock("@/lib/qualitative-api.ts", () => ({
  loadStudy: (...args: unknown[]) => loadStudy(...args),
  addDocument: (...args: unknown[]) => addDocument(...args),
  removeDocument: vi.fn(),
  setCodingOrder: (...args: unknown[]) => setCodingOrder(...args),
  addCode: (...args: unknown[]) => addCode(...args),
  removeCode: vi.fn(),
  applyCoding: (...args: unknown[]) => applyCoding(...args),
  removeCoding: vi.fn(),
  addThemeDraft: vi.fn(),
  removeThemeDraft: vi.fn(),
  listCoders: (...args: unknown[]) => listCoders(...args),
  inviteCoder: (...args: unknown[]) => inviteCoder(...args),
  removeCoder: vi.fn(),
}));

const { CodeText } = await import("./CodeText.tsx");
type StudiesState = import("@/hooks/useStudies.ts").StudiesState;

/**
 * The study bar's state, stubbed.
 *
 * Study selection lives above this component now — one study for all five
 * stages of Research, so a methodology cannot be declared against one study
 * and coded against another. What is left here is the workspace, and what it
 * needs from above is which study (or none).
 */
function studiesState(over: Partial<StudiesState> = {}): StudiesState {
  return {
    studies: null,
    invitations: [],
    studyId: null,
    study: null,
    userId: null,
    isOwner: false,
    problem: null,
    open: vi.fn(),
    start: vi.fn(),
    accept: vi.fn(),
    unblind: vi.fn(),
    ...over,
  };
}

const OPEN_STUDY = {
  id: "s1",
  title: "Waiting",
  question: null,
  blind_coding: true,
  owner_id: "me",
  created_at: "2026-08-23",
};


/**
 * Select a phrase where it is rendered.
 *
 * Labels are excluded by class, deliberately not by the `data-not-source`
 * attribute the component's offset walk uses: keying a check to the thing
 * under test is how a check stops being able to fail.
 */
function selectPhrase(phrase: string) {
  const paragraph = document.querySelector("p.font-serif") as HTMLElement;
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const at = node.textContent!.indexOf(phrase);
    if (at >= 0 && !(node.parentElement as HTMLElement).closest(".align-super")) {
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + phrase.length);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      fireEvent.mouseUp(paragraph);
      return;
    }
    node = walker.nextNode();
  }
  throw new Error(`"${phrase}" is not rendered as transcript text`);
}

const ONE = "The cost was the first thing everyone mentioned, and nobody trusted the process.";

beforeEach(() => {
  vi.clearAllMocks();
  listCoders.mockResolvedValue({ ok: true, data: [] });
});

async function addTranscript(text: string, name: string) {
  await userEvent.click(screen.getByRole("button", { name: /Paste one/ }));
  await userEvent.type(screen.getByLabelText(/Name it/), name);
  await userEvent.type(screen.getByLabelText("The transcript"), text);
  await userEvent.click(screen.getByRole("button", { name: "Add transcript" }));
}

// The honesty rule this feature is most likely to break in a redesign: the
// notice says what is true of the state the workspace is actually in. A single
// hard-coded sentence would be wrong in two of these three.
describe("what it says about whether the work is kept", () => {
  it("tells a signed-out visitor how to keep it", () => {
    render(<CodeText studies={studiesState()} />);
    expect(screen.getByText(/sign in and start a study to keep your coding/)).toBeInTheDocument();
  });

  it("tells a signed-in researcher with no study open that nothing is kept yet", () => {
    render(<CodeText studies={studiesState({ studies: [] })} />);
    expect(
      screen.getByText(/Nothing here is saved until you open or start a study above/),
    ).toBeInTheDocument();
  });

  it("says nothing about losing work once a study is open", async () => {
    loadStudy.mockResolvedValue({
      ok: true,
      data: { documents: [], codes: [], codings: [], drafts: [] },
    });
    render(
      <CodeText studies={studiesState({ studies: [OPEN_STUDY], studyId: "s1", study: OPEN_STUDY })} />,
    );
    await waitFor(() => expect(loadStudy).toHaveBeenCalledWith("s1"));
    expect(screen.queryByText(/Nothing here is saved/)).not.toBeInTheDocument();
  });
});

describe("the qualitative workspace", () => {
  it("offers no coding surface until there is a transcript", () => {
    render(<CodeText studies={studiesState()} />);
    expect(screen.queryByRole("button", { name: /^Code$/ })).not.toBeInTheDocument();
    expect(screen.getByText(/An interview transcript/)).toBeInTheDocument();
  });

  // The one departure from how most tools do this: the exclusion is required,
  // and the form says what it is for rather than only refusing.
  it("will not add a code without saying when not to apply it", async () => {
    render(<CodeText studies={studiesState()} />);
    await addTranscript(ONE, "P1");
    await userEvent.click(screen.getByRole("button", { name: "New code" }));
    await userEvent.type(screen.getByLabelText("Name"), "cost");
    await userEvent.type(screen.getByLabelText("Definition"), "What it costs them.");
    await userEvent.type(screen.getByLabelText("Apply when"), "Any passage about cost.");

    const add = screen.getByRole("button", { name: "Add code" });
    expect(add).toBeDisabled();
    expect(screen.getByText(/Two coders disagreeing with nothing in the codebook/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Not when"), "Not a passing mention.");
    expect(add).toBeEnabled();
    await userEvent.click(add);
    expect(screen.getByText(/0 extracts/)).toBeInTheDocument();
  });

  it("reads saturation in the recorded order, and never declares it reached", async () => {
    render(<CodeText studies={studiesState()} />);
    await addTranscript(ONE, "P1");
    await userEvent.click(screen.getByRole("button", { name: /^Saturation/ }));
    expect(screen.getByText(/No codes have been applied yet/)).toBeInTheDocument();
    expect(screen.queryByText(/saturation was reached/i)).not.toBeInTheDocument();
  });

  it("cannot move the only transcript in either direction", async () => {
    render(<CodeText studies={studiesState()} />);
    await addTranscript(ONE, "P1");
    expect(screen.getByRole("button", { name: /Move P1 earlier/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Move P1 later/ })).toBeDisabled();
  });
});

describe("when the work is kept", () => {
  const open = () =>
    render(
      <CodeText
        studies={studiesState({
          studies: [OPEN_STUDY], studyId: "s1", study: OPEN_STUDY, userId: "me", isOwner: true,
        })}
      />,
    );

  beforeEach(() => {
    loadStudy.mockResolvedValue({
      ok: true,
      data: {
        documents: [
          { id: "d1", name: "P1", body: ONE, coding_position: 1 },
          { id: "d2", name: "P2", body: "Cost came up again.", coding_position: 2 },
        ],
        codes: [
          {
            id: "cost",
            label: "cost",
            definition: "What it costs.",
            when: "Money.",
            notWhen: "Not a passing mention.",
            parentId: null,
          },
        ],
        codings: [{ id: "g1", documentId: "d1", codeId: "cost", start: 4, end: 8, memo: null }],
        drafts: [],
      },
    });
  });

  it("shows what was already coded, sliced out of the stored transcript", async () => {
    open();
    expect(await screen.findByRole("mark")).toHaveTextContent("cost");
    expect(screen.getByText(/1 extract\b/)).toBeInTheDocument();
  });

  // The order is a claim about the analysis, so moving a transcript writes it
  // rather than only rearranging the screen.
  it("records a new coding order on the server when a transcript is moved", async () => {
    setCodingOrder.mockResolvedValue({ ok: true, data: null });
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Move P2 earlier/ }));
    await waitFor(() => expect(setCodingOrder).toHaveBeenCalledWith("s1", ["d2", "d1"]));
  });

  // A coding the database refused must never appear on screen: the extract
  // beneath it would be sliced from a document that does not agree, and the
  // researcher would be reading a quotation nobody said.
  it("does not show a coding the server refused, and says what happened", async () => {
    applyCoding.mockResolvedValue({
      ok: false,
      message: "that selection is outside the document (4-99 of 79)",
    });
    open();
    await screen.findByRole("mark");
    const marksBefore = screen.getAllByRole("mark").length;

    selectPhrase("trusted");
    expect(screen.getByText("trusted", { selector: "blockquote" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "cost" }));

    await waitFor(() => expect(applyCoding).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent(/outside the document/);
    expect(screen.getAllByRole("mark")).toHaveLength(marksBefore);
  });

  // The control for the test above: the same interaction, accepted.
  it("shows it when the server accepts it", async () => {
    applyCoding.mockResolvedValue({ ok: true, data: "g2" });
    open();
    await screen.findByRole("mark");
    const marksBefore = screen.getAllByRole("mark").length;

    selectPhrase("trusted");
    await userEvent.click(screen.getByRole("button", { name: "cost" }));

    await waitFor(() => expect(screen.getAllByRole("mark")).toHaveLength(marksBefore + 1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
