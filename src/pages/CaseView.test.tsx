// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const getCase = vi.fn();
const listClaims = vi.fn();
const listSources = vi.fn();
vi.mock("@/lib/detective-api.ts", () => ({
  getCase: (...a: unknown[]) => getCase(...a),
  listClaims: (...a: unknown[]) => listClaims(...a),
  listSources: (...a: unknown[]) => listSources(...a),
}));
vi.mock("@/components/RequireSession.tsx", () => ({
  RequireSession: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { default: CaseView } = await import("./CaseView.tsx");

const draw = () =>
  render(
    <MemoryRouter initialEntries={["/cases/abc"]}>
      <Routes>
        <Route path="/cases/:id" element={<CaseView />} />
      </Routes>
    </MemoryRouter>,
  );

const investigation = {
  id: "abc", title: "A tender award", question: "When was it awarded?",
  visibility: "private" as const, created_at: "2026-08-01T00:00:00Z",
};

describe("opening a case", () => {
  beforeEach(() => {
    getCase.mockReset().mockResolvedValue({ ok: true, data: investigation });
    listClaims.mockReset().mockResolvedValue({ ok: true, data: [] });
    listSources.mockReset().mockResolvedValue({ ok: true, data: [] });
  });

  it("shows the title and the question", async () => {
    draw();
    await waitFor(() => expect(screen.getByText("A tender award")).toBeInTheDocument());
    expect(screen.getByText("When was it awarded?")).toBeInTheDocument();
  });

  // §18: a private case must be inaccessible even to somebody holding its id,
  // and confirming that it exists would breach exactly that. RLS returns no
  // row either way, and the copy must not resolve the ambiguity.
  it("does not say whether a case it cannot show exists", async () => {
    getCase.mockResolvedValue({ ok: true, data: null });
    draw();
    await waitFor(() => expect(screen.getByText(/no case here/i)).toBeInTheDocument());
    expect(screen.getByText(/deliberately does not say which/i)).toBeInTheDocument();
  });

  it("renders a claim with its epistemic status", async () => {
    listClaims.mockResolvedValue({
      ok: true,
      data: [{ id: "c1", statement: "The tender was awarded in March.", status: "contested", asserted_by: "The gazette" }],
    });
    draw();
    await waitFor(() => expect(screen.getByText(/awarded in March/)).toBeInTheDocument());
    expect(screen.getByText("Contested")).toBeInTheDocument();
    expect(screen.getByText(/Asserted by The gazette/)).toBeInTheDocument();
  });

  // A source whose origin is not on screen is one nobody will check.
  it("always shows a source's provenance", async () => {
    listSources.mockResolvedValue({
      ok: true,
      data: [{
        id: "s1", kind: "official_record", title: "A gazette notice",
        retrieved_from: "https://gazette.example.org/2026/114",
        retrieved_at: "2026-08-02T00:00:00Z",
      }],
    });
    draw();
    await waitFor(() => expect(screen.getByText("A gazette notice")).toBeInTheDocument());
    expect(screen.getByText(/gazette\.example\.org\/2026\/114/)).toBeInTheDocument();
    expect(screen.getByText(/official record/)).toBeInTheDocument();
  });

  it("says what a claim is when there are none, rather than showing nothing", async () => {
    draw();
    await waitFor(() => {
      expect(screen.getByText(/kept separate from the evidence for and against it/i))
        .toBeInTheDocument();
    });
  });
});
