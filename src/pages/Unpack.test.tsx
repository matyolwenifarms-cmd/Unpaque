// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SECTION_IDS, type DiagnosticReport } from "@shared/diagnostic/report.ts";

const requestAnalysis = vi.fn();
vi.mock("@/lib/api.ts", () => ({ requestAnalysis: (...args: unknown[]) => requestAnalysis(...args) }));

const { default: Unpack } = await import("./Unpack.tsx");

const LONG_ENOUGH =
  "Following a review of resourcing, the project cannot proceed on the original timeline.";

const SPAN = "cannot proceed";
const SPAN_START = LONG_ENOUGH.indexOf(SPAN);

function report(): DiagnosticReport {
  return {
    mode: "decode",
    verdict: "The message declines to proceed by reporting a constraint.",
    // An offset into LONG_ENOUGH, because that is what the page submits.
    annotations: [{
      start: SPAN_START,
      end: SPAN_START + SPAN.length,
      device: "agentless_framing",
      framework: "critical_discourse",
      aspect: "responsibility",
      note: "The inability is reported without naming who determined it.",
    }],
    sections: SECTION_IDS.map((id) => ({ id, summary: `Summary ${id}.`, findings: [] })),
  };
}

async function submit() {
  const user = userEvent.setup();
  render(<Unpack />);
  await user.type(screen.getByLabelText(/text to analyse/i), LONG_ENOUGH);
  await user.click(screen.getByRole("button", { name: /^analyse$/i }));
}

describe("the stub disclosure", () => {
  beforeEach(() => requestAnalysis.mockReset());

  // This is the assertion most likely to be dropped in a redesign, and the one
  // whose absence does the most damage: fixed example text read as a diagnosis
  // of what the user actually pasted.
  it("says plainly that nothing was analysed when the report is a stub", async () => {
    requestAnalysis.mockResolvedValue({ status: "ok", report: report(), source: LONG_ENOUGH, repaired: false, stub: true });
    await submit();
    await waitFor(() => {
      expect(screen.getByText(/stub mode — this is not an analysis/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/did not read your text/i)).toBeInTheDocument();
  });

  it("shows no such banner for a real report", async () => {
    requestAnalysis.mockResolvedValue({ status: "ok", report: report(), source: LONG_ENOUGH, repaired: false, stub: false });
    await submit();
    await waitFor(() => expect(screen.getByText(/Summary act\./)).toBeInTheDocument());
    expect(screen.queryByText(/stub mode/i)).not.toBeInTheDocument();
  });

  it("shows the engine's own words when it refuses, not a generic failure", async () => {
    requestAnalysis.mockResolvedValue({
      status: "error",
      code: "boundary",
      message: "Unpaque could not produce a report that stays inside its own limits.",
    });
    await submit();
    await waitFor(() => {
      expect(screen.getByText(/stays inside its own limits/i)).toBeInTheDocument();
    });
  });
});

describe("depth, and the text a report belongs to", () => {
  it("switches the device label without re-analysing", async () => {
    requestAnalysis.mockResolvedValue({ status: "ok", report: report(), source: LONG_ENOUGH, stub: false });
    const user = userEvent.setup();
    render(<Unpack />);
    await user.type(screen.getByLabelText(/text to analyse/i), LONG_ENOUGH);
    await user.click(screen.getByRole("button", { name: /^analyse$/i }));
    // queryAllByText, not getAllByText: the latter throws when there are none,
    // which is the state being asserted.
    await waitFor(() => expect(screen.getByLabelText(/annotated source/i)).toBeInTheDocument());
    expect(screen.queryAllByText(/no one named/i)).toHaveLength(0);
    expect(screen.getAllByText(/agentless framing/i).length).toBeGreaterThan(0);

    // Counted as a delta: the spy is shared across this file's tests, so an
    // absolute count would assert something about the tests above rather than
    // about the switch.
    const before = requestAnalysis.mock.calls.length;
    await user.click(screen.getByRole("button", { name: /^basic$/i }));
    expect(screen.getAllByText(/no one named/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/agentless framing/i)).toHaveLength(0);
    // The whole point of the switch being a lookup: no second call.
    expect(requestAnalysis.mock.calls.length).toBe(before);
  });

  // The offsets belong to the submitted text. Rendering against the live box
  // would shift every highlight the moment somebody typed another word — into
  // a message the analysis never saw.
  it("keeps the highlights on the text that was analysed, not the box", async () => {
    requestAnalysis.mockResolvedValue({ status: "ok", report: report(), source: LONG_ENOUGH, stub: false });
    const user = userEvent.setup();
    render(<Unpack />);
    const box = screen.getByLabelText(/text to analyse/i);
    await user.type(box, LONG_ENOUGH);
    await user.click(screen.getByRole("button", { name: /^analyse$/i }));
    await waitFor(() =>
      expect(screen.getByLabelText(/annotated source/i)).toBeInTheDocument(),
    );

    await user.type(box, " And some more words entirely.");
    const annotated = screen.getByLabelText(/annotated source/i);
    expect(annotated.textContent).not.toContain("And some more words entirely.");
    expect([...annotated.querySelectorAll("mark")].map((m) => m.textContent)).toEqual([SPAN]);
  });
});
