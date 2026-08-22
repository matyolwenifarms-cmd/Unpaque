// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const createClaim = vi.fn();
const createSource = vi.fn();
vi.mock("@/lib/detective-api.ts", () => ({
  createClaim: (...a: unknown[]) => createClaim(...a),
  createSource: (...a: unknown[]) => createSource(...a),
}));

const { AddClaim } = await import("./AddClaim.tsx");
const { AddSource } = await import("./AddSource.tsx");

describe("adding a claim", () => {
  beforeEach(() => {
    createClaim.mockReset().mockResolvedValue({
      ok: true, data: { id: "c1", statement: "s", status: "unknown", asserted_by: null },
    });
  });

  // §3: a claim is not a fact. There is no status field, so "corroborated"
  // cannot be something you type about your own claim.
  it("offers no way to choose a status", () => {
    render(<AddClaim caseId="case-1" onAdded={() => {}} />);
    expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument();
    expect(screen.getByText(/only evidence moves it from there/i)).toBeInTheDocument();
  });

  it("records what is asserted and who asserts it", async () => {
    const user = userEvent.setup();
    render(<AddClaim caseId="case-1" onAdded={() => {}} />);
    await user.type(screen.getByLabelText(/what is asserted/i), "The tender was awarded in March.");
    await user.type(screen.getByLabelText(/who or what asserts it/i), "The gazette");
    await user.click(screen.getByRole("button", { name: /add claim/i }));
    await waitFor(() => expect(createClaim).toHaveBeenCalledWith("case-1", {
      statement: "The tender was awarded in March.",
      assertedBy: "The gazette",
    }));
  });

  it("will not submit an empty statement", () => {
    render(<AddClaim caseId="case-1" onAdded={() => {}} />);
    expect(screen.getByRole("button", { name: /add claim/i })).toBeDisabled();
  });
});

describe("adding a source", () => {
  beforeEach(() => {
    createSource.mockReset().mockResolvedValue({
      ok: true,
      data: { id: "s1", kind: "other", title: "t", retrieved_from: "f", retrieved_at: "2026-01-01" },
    });
  });

  // The database refuses a source with no provenance. The form asks plainly
  // rather than letting somebody meet the constraint by hitting it.
  it("will not submit without provenance, and says why it is needed", () => {
    render(<AddSource caseId="case-1" onAdded={() => {}} />);
    expect(screen.getByText(/not evidence of anything/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add source/i })).toBeDisabled();
  });

  it("enables once both the title and the provenance are given", async () => {
    const user = userEvent.setup();
    render(<AddSource caseId="case-1" onAdded={() => {}} />);
    await user.type(screen.getByLabelText(/what is it/i), "A gazette notice");
    expect(screen.getByRole("button", { name: /add source/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/where did it come from/i), "gazette.example.org/114");
    expect(screen.getByRole("button", { name: /add source/i })).toBeEnabled();
  });
});
