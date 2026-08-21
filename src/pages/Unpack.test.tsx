// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SECTION_IDS, type DiagnosticReport } from "@shared/diagnostic/report.ts";

const requestAnalysis = vi.fn();
vi.mock("@/lib/api.ts", () => ({ requestAnalysis: (...args: unknown[]) => requestAnalysis(...args) }));

const { default: Unpack } = await import("./Unpack.tsx");

function report(): DiagnosticReport {
  return {
    mode: "decode",
    sections: SECTION_IDS.map((id) => ({ id, summary: `Summary ${id}.`, findings: [] })),
  };
}

const LONG_ENOUGH =
  "Following a review of resourcing, the project cannot proceed on the original timeline.";

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
    requestAnalysis.mockResolvedValue({ status: "ok", report: report(), repaired: false, stub: true });
    await submit();
    await waitFor(() => {
      expect(screen.getByText(/stub mode — this is not an analysis/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/did not read your text/i)).toBeInTheDocument();
  });

  it("shows no such banner for a real report", async () => {
    requestAnalysis.mockResolvedValue({ status: "ok", report: report(), repaired: false, stub: false });
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
