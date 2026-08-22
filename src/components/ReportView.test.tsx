// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportView } from "./ReportView.tsx";
import { SECTION_IDS, type DiagnosticReport } from "@shared/diagnostic/report.ts";

// The submitted text. Annotations are offsets into this, so the fixture and
// the assertions both read from one place.
const SOURCE =
  "Following a review of current operating conditions, a decision has been made " +
  "to consolidate several roles. We will be in touch in due course.";

const spanOf = (phrase: string) => {
  const start = SOURCE.indexOf(phrase);
  if (start < 0) throw new Error(`fixture error: "${phrase}" is not in SOURCE`);
  return { start, end: start + phrase.length };
};

function report(overrides: Partial<DiagnosticReport> = {}): DiagnosticReport {
  return {
    mode: "decode",
    verdict: "The message reports an outcome without naming who decided it.",
    annotations: [
      {
        ...spanOf("a decision has been made"),
        device: "agentless_framing",
        framework: "critical_discourse",
        aspect: "responsibility",
        note: "The passive construction reports the outcome without naming who chose it.",
      },
      {
        ...spanOf("in due course"),
        device: "strategic_vagueness",
        framework: "strategic_ambiguity",
        aspect: "ambiguity",
        note: "The commitment carries no date, threshold or named condition.",
      },
    ],
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
  // Annotated source, then the verdict, then the four aspects. The order is
  // the site's: a reader meets their own text before they meet a finding
  // about it.
  it("leads with the annotated source and the verdict, then the four aspects", () => {
    render(<ReportView report={report()} source={SOURCE} />);
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(SECTION_IDS.length + 2);
    expect(headings[0]).toHaveTextContent(/annotated source/i);
    expect(headings[1]).toHaveTextContent(/without naming who decided it/i);
    expect(headings[2]).toHaveTextContent(/what this is doing/i);
  });

  it("shows the verbatim quote as evidence", () => {
    render(<ReportView report={report()} source={SOURCE} />);
    expect(screen.getByText(/no capacity this quarter/)).toBeInTheDocument();
  });

  it("says so when a section has nothing to report rather than rendering blank", () => {
    render(<ReportView report={report()} source={SOURCE} />);
    expect(screen.getAllByText(/nothing structurally notable/i).length).toBe(
      SECTION_IDS.length - 1,
    );
  });

  it("keeps the framework attribution visible, and reveals the gloss on request", async () => {
    const user = userEvent.setup();
    render(<ReportView report={report()} source={SOURCE} />);
    const attribution = screen.getByRole("button", { name: /speech act theory/i });
    expect(attribution).toHaveAttribute("aria-expanded", "false");
    await user.click(attribution);
    expect(attribution).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Austin \(1962\)/)).toBeInTheDocument();
  });

  it("renders the rewrite only when there is one", () => {
    const { rerender } = render(<ReportView report={report()} source={SOURCE} />);
    expect(screen.queryByText(/structurally revised/i)).not.toBeInTheDocument();

    rerender(
      <ReportView
        report={report({
          mode: "draft",
          rewrite: { text: "A clearer version.", note: "The request is stated once." },
        })}
        source={SOURCE}
      />,
    );
    expect(screen.getByText(/structurally revised/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy rewrite/i })).toBeInTheDocument();
  });
});

describe("the annotated source", () => {
  // The reader is looking at their own message. A view that showed only the
  // flagged phrases would be a list of quotations — which is what this
  // replaced, and what could not say where anything was.
  it("shows the whole submitted text, not just the highlights", () => {
    render(<ReportView report={report()} source={SOURCE} />);
    const annotated = screen.getByLabelText(/annotated source/i);
    expect(annotated.textContent).toContain("Following a review of current operating conditions");
    expect(annotated.textContent).toContain("to consolidate several roles");
  });

  it("marks each annotated span", () => {
    render(<ReportView report={report()} source={SOURCE} />);
    const marks = screen.getByLabelText(/annotated source/i).querySelectorAll("mark");
    expect([...marks].map((m) => m.textContent)).toEqual([
      "a decision has been made",
      "in due course",
    ]);
  });

  it("leads with the verdict", () => {
    render(<ReportView report={report()} source={SOURCE} />);
    expect(
      screen.getByRole("heading", { name: /without naming who decided it/i }),
    ).toBeInTheDocument();
  });

  // The device label is the whole of the Basic/Advanced switch. Same spans,
  // same order, same explanations — different words for the device.
  it("says nominalisation in advanced and plain words in basic", () => {
    const annotated = { ...report(), annotations: [{
      ...spanOf("a decision has been made"),
      device: "nominalisation" as const,
      framework: "critical_discourse" as const,
      aspect: "responsibility" as const,
      note: "n",
    }] };

    const { unmount } = render(<ReportView report={annotated} source={SOURCE} depth="advanced" />);
    expect(screen.getAllByText(/nominalisation/i).length).toBeGreaterThan(0);
    unmount();

    render(<ReportView report={annotated} source={SOURCE} depth="basic" />);
    expect(screen.queryByText(/nominalisation/i)).toBeNull();
    expect(screen.getAllByText(/action turned into a thing/i).length).toBeGreaterThan(0);
  });

  it("slices the chip from the source rather than trusting a carried string", () => {
    render(<ReportView report={report()} source={SOURCE} />);
    // Two places show the phrase: the mark in the annotated source and the
    // chip above its explanation. Both are sliced by offset; neither is a
    // string the model handed over.
    expect(screen.getAllByText("a decision has been made")).toHaveLength(2);
  });

  // An absence is a result; rendering nothing would read as a bug.
  it("says so when nothing was singled out", () => {
    render(<ReportView report={report({ annotations: [] })} source={SOURCE} />);
    expect(screen.getByText(/No individual phrase was singled out/i)).toBeInTheDocument();
  });
});
