// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportView } from "./ReportView.tsx";
import { SECTION_IDS, type DiagnosticReport } from "@shared/diagnostic/report.ts";

function report(overrides: Partial<DiagnosticReport> = {}): DiagnosticReport {
  return {
    mode: "decode",
    sections: SECTION_IDS.map((id) => ({
      id,
      summary: `Summary for ${id}.`,
      findings:
        id === "act"
          ? [
              {
                framework: "speech_act",
                claim: "The refusal is carried by a statement of constraint.",
                quotes: ["there is no capacity this quarter"],
              },
            ]
          : [],
    })),
    ...overrides,
  };
}

describe("ReportView", () => {
  it("renders every section, in render order", () => {
    render(<ReportView report={report()} />);
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(SECTION_IDS.length);
    expect(headings[0]).toHaveTextContent(/what this is doing/i);
  });

  it("shows the verbatim quote as evidence", () => {
    render(<ReportView report={report()} />);
    expect(screen.getByText(/no capacity this quarter/)).toBeInTheDocument();
  });

  it("says so when a section has nothing to report rather than rendering blank", () => {
    render(<ReportView report={report()} />);
    expect(screen.getAllByText(/nothing structurally notable/i).length).toBe(
      SECTION_IDS.length - 1,
    );
  });

  it("keeps the framework attribution visible, and reveals the gloss on request", async () => {
    const user = userEvent.setup();
    render(<ReportView report={report()} />);
    const attribution = screen.getByRole("button", { name: /speech act theory/i });
    expect(attribution).toHaveAttribute("aria-expanded", "false");
    await user.click(attribution);
    expect(attribution).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Austin \(1962\)/)).toBeInTheDocument();
  });

  it("renders the rewrite only when there is one", () => {
    const { rerender } = render(<ReportView report={report()} />);
    expect(screen.queryByText(/structurally revised/i)).not.toBeInTheDocument();

    rerender(
      <ReportView
        report={report({
          mode: "draft",
          rewrite: { text: "A clearer version.", note: "The request is stated once." },
        })}
      />,
    );
    expect(screen.getByText(/structurally revised/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy rewrite/i })).toBeInTheDocument();
  });
});
