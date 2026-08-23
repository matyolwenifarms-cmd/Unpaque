// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const getCase = vi.fn();
const listClaims = vi.fn();
const listSources = vi.fn();
const listEvidence = vi.fn();
const listEvents = vi.fn();
const listHypotheses = vi.fn();
const listHypothesisEvidence = vi.fn();
const listEntities = vi.fn();
const listEdges = vi.fn();
// Every export the page reaches for. A missing one is not a missing assertion:
// the page calls them inside a Promise.all, so an undefined mock rejects and
// nothing renders at all — which shows up as five unrelated "cannot find text"
// failures. This only appeared in the full suite; the file passed alone.
vi.mock("@/lib/detective-api.ts", () => ({
  getCase: (...a: unknown[]) => getCase(...a),
  listClaims: (...a: unknown[]) => listClaims(...a),
  listSources: (...a: unknown[]) => listSources(...a),
  listEvidence: (...a: unknown[]) => listEvidence(...a),
  listEvents: (...a: unknown[]) => listEvents(...a),
  createClaim: vi.fn(),
  createSource: vi.fn(),
  createEvidence: vi.fn(),
  createEvent: vi.fn(),
  // The case view loads these in the same Promise.all as the rest, so a mock
  // missing them rejects the whole load and the page renders nothing at all.
  listHypotheses: () => listHypotheses(),
  listHypothesisEvidence: () => listHypothesisEvidence(),
  listEntities: () => listEntities(),
  listEdges: () => listEdges(),
  createEntity: vi.fn(),
  deleteEntity: vi.fn(),
  createEdge: vi.fn(),
  deleteEdge: vi.fn(),
  createHypothesis: vi.fn(),
  deleteHypothesis: vi.fn(),
  linkHypothesisEvidence: vi.fn(),
  unlinkHypothesisEvidence: vi.fn(),
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
    listEvidence.mockReset().mockResolvedValue({ ok: true, data: [] });
    listEvents.mockReset().mockResolvedValue({ ok: true, data: [] });
    listHypotheses.mockReset().mockResolvedValue({ ok: true, data: [] });
    listHypothesisEvidence.mockReset().mockResolvedValue({ ok: true, data: [] });
    listEntities.mockReset().mockResolvedValue({ ok: true, data: [] });
    listEdges.mockReset().mockResolvedValue({ ok: true, data: [] });
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
    const claims = await screen.findByRole("region", { name: /claims/i });
    await waitFor(() => expect(within(claims).getByText(/awarded in March/)).toBeInTheDocument());
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
    // A source title legitimately appears in the sources list, in the evidence
    // line, and as an <option> in both the link-evidence and add-event forms.
    // Every assertion here is scoped to the list item rather than loosened.
    await waitFor(() => expect(screen.getAllByText("A gazette notice").length).toBeGreaterThan(0));
    // Scoped to the list, not the section: the add-source form sits inside the
    // same section and its <option> elements carry the same words.
    const sourcesSection = screen.getByRole("region", { name: /sources/i });
    const sourceList = within(sourcesSection).getAllByRole("listitem")[0]!;
    expect(within(sourceList).getByText(/gazette\.example\.org\/2026\/114/)).toBeInTheDocument();
    expect(within(sourceList).getByText(/official record/)).toBeInTheDocument();
  });

  it("says what a claim is when there are none, rather than showing nothing", async () => {
    draw();
    await waitFor(() => {
      expect(screen.getByText(/kept separate from the evidence for and against it/i))
        .toBeInTheDocument();
    });
  });
});

describe("what the page will and will not do for you", () => {
  const claim = {
    id: "c1", statement: "The tender was awarded in March.",
    status: "unknown" as const, asserted_by: "The gazette",
  };
  const twoSources = [
    { id: "s1", kind: "official_record", title: "A gazette notice", retrieved_from: "f", retrieved_at: "x" },
    { id: "s2", kind: "reporting", title: "A newspaper report", retrieved_from: "f", retrieved_at: "x" },
  ];

  beforeEach(() => {
    getCase.mockReset().mockResolvedValue({ ok: true, data: investigation });
    listClaims.mockReset().mockResolvedValue({ ok: true, data: [claim] });
    listSources.mockReset().mockResolvedValue({ ok: true, data: twoSources });
    listEvidence.mockReset().mockResolvedValue({ ok: true, data: [] });
    listEvents.mockReset().mockResolvedValue({ ok: true, data: [] });
    listHypotheses.mockReset().mockResolvedValue({ ok: true, data: [] });
    listHypothesisEvidence.mockReset().mockResolvedValue({ ok: true, data: [] });
    listEntities.mockReset().mockResolvedValue({ ok: true, data: [] });
    listEdges.mockReset().mockResolvedValue({ ok: true, data: [] });
  });

  it("lists the evidence bearing on a claim, with its excerpt", async () => {
    listEvidence.mockResolvedValue({
      ok: true,
      data: [{ id: "e1", claim_id: "c1", source_id: "s1", classification: "supports", excerpt: "Award published 14 March." }],
    });
    draw();
    const claimsSection = await screen.findByRole("region", { name: /claims/i });
    await waitFor(() =>
      expect(within(claimsSection).getByText(/Award published 14 March/)).toBeInTheDocument(),
    );
    const evidenceLine = within(claimsSection).getByText(/Award published 14 March/).closest("li")!;
    expect(within(evidenceLine).getByText(/supports/)).toBeInTheDocument();
    expect(evidenceLine.textContent).toMatch(/A gazette notice/);
  });

  // §4 keeps human authority explicit. Moving a claim because a count crossed
  // two would be exactly the collapse into truth the epistemic model prevents,
  // so the page offers permission and says outright that it will not act.
  it("offers corroboration as permission and says it will not do it", async () => {
    listEvidence.mockResolvedValue({
      ok: true,
      data: [
        { id: "e1", claim_id: "c1", source_id: "s1", classification: "supports", excerpt: null },
        { id: "e2", claim_id: "c1", source_id: "s2", classification: "supports", excerpt: null },
      ],
    });
    draw();
    await waitFor(() => {
      expect(screen.getByText(/You may mark it corroborated — Unpaque\s+will not/i)).toBeInTheDocument();
    });
  });

  it("offers nothing of the sort when a source contradicts", async () => {
    listEvidence.mockResolvedValue({
      ok: true,
      data: [
        { id: "e1", claim_id: "c1", source_id: "s1", classification: "supports", excerpt: null },
        { id: "e2", claim_id: "c1", source_id: "s2", classification: "supports", excerpt: null },
        { id: "e3", claim_id: "c1", source_id: "s2", classification: "contradicts", excerpt: null },
      ],
    });
    draw();
    const claims = await screen.findByRole("region", { name: /claims/i });
    await waitFor(() => expect(within(claims).getByText(/awarded in March/)).toBeInTheDocument());
    expect(screen.queryByText(/may mark it corroborated/i)).not.toBeInTheDocument();
  });
});

describe("the dossier", () => {
  beforeEach(() => {
    getCase.mockReset().mockResolvedValue({ ok: true, data: investigation });
    listClaims.mockReset().mockResolvedValue({
      ok: true,
      data: [
        { id: "c1", statement: "The tender was awarded in March.", status: "claim", asserted_by: "the register" },
        { id: "c2", statement: "Only one bid was received.", status: "claim", asserted_by: null },
      ],
    });
    listSources.mockReset().mockResolvedValue({
      ok: true,
      data: [
        { id: "s1", kind: "official_record", title: "Tender register", retrieved_from: "portal", retrieved_at: "2026-08-01T00:00:00Z", content_hash: "a" },
        { id: "s2", kind: "reporting", title: "Local paper", retrieved_from: "url", retrieved_at: "2026-08-01T00:00:00Z", content_hash: "b" },
      ],
    });
    listEvidence.mockReset().mockResolvedValue({
      ok: true,
      data: [
        { id: "v1", claim_id: "c1", source_id: "s1", classification: "supports", excerpt: "awarded 12 March" },
        { id: "v2", claim_id: "c1", source_id: "s2", classification: "supports", excerpt: null },
      ],
    });
    listEvents.mockReset().mockResolvedValue({ ok: true, data: [] });
    listHypotheses.mockReset().mockResolvedValue({ ok: true, data: [] });
    listHypothesisEvidence.mockReset().mockResolvedValue({ ok: true, data: [] });
    listEntities.mockReset().mockResolvedValue({ ok: true, data: [] });
    listEdges.mockReset().mockResolvedValue({ ok: true, data: [] });
  });

  it("appears at the foot of the case, after the records it reads", async () => {
    draw();
    await waitFor(() => expect(screen.getByLabelText(/dossier/i)).toBeInTheDocument());
    const html = document.body.innerHTML;
    expect(html.indexOf("timeline-heading")).toBeLessThan(html.indexOf('id="dossier"'));
  });

  it("answers §4's three questions, in that order", async () => {
    draw();
    await waitFor(() => expect(screen.getByLabelText(/dossier/i)).toBeInTheDocument());
    const text = screen.getByLabelText(/dossier/i).textContent ?? "";
    const supports = text.indexOf("What the evidence supports");
    const unknown = text.indexOf("What remains unknown");
    const notFit = text.indexOf("What does not fit");
    expect(supports).toBeGreaterThan(-1);
    expect(unknown).toBeGreaterThan(supports);
    expect(notFit).toBeGreaterThan(unknown);
  });

  // "Who did it" is not a question this document answers, and the absence is
  // the product.
  it("concludes nothing", async () => {
    draw();
    await waitFor(() => expect(screen.getByLabelText(/dossier/i)).toBeInTheDocument());
    const text = screen.getByLabelText(/dossier/i).textContent ?? "";
    for (const forbidden of [/\bwe conclude\b/i, /\bis guilty\b/i, /\bthe culprit\b/i, /\bproves\b/i]) {
      expect(text).not.toMatch(forbidden);
    }
  });

  it("says what it is before it says anything else", async () => {
    draw();
    await waitFor(() => expect(screen.getByLabelText(/dossier/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/dossier/i).textContent).toMatch(
      /Nothing here is a conclusion about what happened/,
    );
  });
});
