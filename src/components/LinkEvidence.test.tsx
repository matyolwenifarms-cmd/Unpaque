// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const createEvidence = vi.fn();
vi.mock("@/lib/detective-api.ts", () => ({
  createEvidence: (...a: unknown[]) => createEvidence(...a),
}));

const { LinkEvidence } = await import("./LinkEvidence.tsx");

const sources = [
  { id: "s1", kind: "official_record", title: "A gazette notice", retrieved_from: "f", retrieved_at: "x" },
  { id: "s2", kind: "reporting", title: "A newspaper report", retrieved_from: "f", retrieved_at: "x" },
];

const draw = (over = {}) =>
  render(
    <LinkEvidence caseId="case-1" claimId="claim-1" sources={sources} onLinked={() => {}} {...over} />,
  );

describe("linking evidence to a claim", () => {
  beforeEach(() => {
    createEvidence.mockReset().mockResolvedValue({
      ok: true,
      data: { id: "e1", claim_id: "claim-1", source_id: "s1", classification: "supports", excerpt: null },
    });
  });

  it("says what to do first when there are no sources", () => {
    draw({ sources: [] });
    expect(screen.getByText(/add a source first/i)).toBeInTheDocument();
  });

  it("links a source with a classification and an excerpt", async () => {
    const user = userEvent.setup();
    draw();
    await user.selectOptions(screen.getByLabelText(/^source$/i), "s2");
    await user.selectOptions(screen.getByLabelText(/how it bears on the claim/i), "contradicts");
    await user.type(screen.getByLabelText(/what in the source says so/i), "Award published 14 May.");
    await user.click(screen.getByRole("button", { name: /link evidence/i }));
    await waitFor(() => expect(createEvidence).toHaveBeenCalledWith("case-1", {
      claimId: "claim-1", sourceId: "s2", classification: "contradicts",
      excerpt: "Award published 14 May.",
    }));
  });

  // The database refuses the duplicate; the interface has to explain why it
  // matters rather than passing a constraint name through.
  it("explains a refused duplicate in terms of what it would distort", async () => {
    createEvidence.mockResolvedValue({
      ok: false,
      message: 'duplicate key value violates unique constraint "evidence_claim_id_source_id_classification_key"',
    });
    const user = userEvent.setup();
    draw();
    await user.selectOptions(screen.getByLabelText(/^source$/i), "s1");
    await user.click(screen.getByRole("button", { name: /link evidence/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/make one source look like two/i);
    });
    expect(screen.getByRole("alert")).not.toHaveTextContent(/unique constraint/);
  });

  it("asks for the quotation, so a reader can check it", () => {
    draw();
    expect(screen.getByLabelText(/quote it, so a reader can check/i)).toBeInTheDocument();
  });

  it("will not link without choosing a source", () => {
    draw();
    expect(screen.getByRole("button", { name: /link evidence/i })).toBeDisabled();
  });
});
