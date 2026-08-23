// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const getCase = vi.fn();
const listClaims = vi.fn();
const listSources = vi.fn();
const listEvents = vi.fn();
const listHypotheses = vi.fn();
const listHypothesisEvidence = vi.fn();

vi.mock("@/lib/detective-api.ts", () => ({
  getCase: (...a: unknown[]) => getCase(...a),
  listClaims: (...a: unknown[]) => listClaims(...a),
  listSources: (...a: unknown[]) => listSources(...a),
  listEvents: (...a: unknown[]) => listEvents(...a),
  listHypotheses: (...a: unknown[]) => listHypotheses(...a),
  listHypothesisEvidence: (...a: unknown[]) => listHypothesisEvidence(...a),
}));
vi.mock("@/components/RequireSession.tsx", () => ({
  RequireSession: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { default: Broadcast } = await import("./Broadcast.tsx");

const draw = () =>
  render(
    <MemoryRouter initialEntries={["/cases/abc/broadcast"]}>
      <Routes>
        <Route path="/cases/:id/broadcast" element={<Broadcast />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  getCase.mockReset().mockResolvedValue({
    ok: true,
    data: { id: "abc", title: "The depot", question: "Who moved the van?", visibility: "private", created_at: "2026-08-01" },
  });
  listClaims.mockReset().mockResolvedValue({ ok: true, data: [] });
  listSources.mockReset().mockResolvedValue({ ok: true, data: [] });
  listEvents.mockReset().mockResolvedValue({ ok: true, data: [] });
  listHypotheses.mockReset().mockResolvedValue({ ok: true, data: [] });
  listHypothesisEvidence.mockReset().mockResolvedValue({ ok: true, data: [] });
});

describe("a case laid out for a camera", () => {
  it("shows the case title and a way back out", async () => {
    draw();
    expect(await screen.findByRole("heading", { name: "The depot", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leave broadcast" })).toBeInTheDocument();
  });

  // Sections 7 and 8 are not built, and a frame around an absence would be
  // worse than saying so.
  it("says on screen that there is no media, transcript or playback", async () => {
    draw();
    expect(await screen.findByText(/Media, transcripts and synchronised playback are not built/))
      .toBeInTheDocument();
  });

  it("switches panel on a number key, because a presenter has no cursor", async () => {
    listSources.mockResolvedValue({
      ok: true,
      data: [{ id: "s1", kind: "official_record", title: "Gate log", retrieved_from: "x", retrieved_at: "y", content_hash: null, reference: 14 }],
    });
    draw();
    await screen.findByRole("heading", { name: "The depot", level: 2 });
    await userEvent.keyboard("2");
    await waitFor(() => expect(screen.getByText("SOURCE 014")).toBeInTheDocument());
  });

  // The viewer keeps the caption, not the presenter's qualification.
  it("puts the epistemic status on screen with every claim", async () => {
    listClaims.mockResolvedValue({
      ok: true,
      data: [
        { id: "c1", statement: "The van left before nine.", status: "partially_corroborated", asserted_by: null },
        { id: "c2", statement: "Nobody saw it.", status: "unknown", asserted_by: null },
      ],
    });
    draw();
    expect(await screen.findByText("The van left before nine.")).toBeInTheDocument();
    expect(screen.getByText("PARTIALLY CORROBORATED")).toBeInTheDocument();
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
  });

  it("shows an unknown time as unknown rather than as a gap", async () => {
    listEvents.mockResolvedValue({
      ok: true,
      data: [{ id: "e1", label: "The van left", occurred_at: null, certainty: "unknown", origin: "reported", source_id: "s1", moment: null }],
    });
    draw();
    await screen.findByRole("heading", { name: "The depot", level: 2 });
    await userEvent.keyboard("3");
    await waitFor(() => expect(screen.getByText("TIME UNKNOWN")).toBeInTheDocument());
  });

  // The same refusal the case page makes, on a screen where it matters more.
  it("refuses to present a lone explanation", async () => {
    listHypotheses.mockResolvedValue({
      ok: true,
      data: [{ id: "h1", statement: "The driver left early.", falsifier: "A gate log.", assumptions: [] }],
    });
    draw();
    await screen.findByRole("heading", { name: "The depot", level: 2 });
    await userEvent.keyboard("4");
    await waitFor(() =>
      expect(screen.getByText(/alternatives were never written down/)).toBeInTheDocument(),
    );
  });

  it("scores no explanation, even with support on the table", async () => {
    listHypotheses.mockResolvedValue({
      ok: true,
      data: [
        { id: "h1", statement: "The driver left early.", falsifier: "A gate log.", assumptions: [] },
        { id: "h2", statement: "The driver never left.", falsifier: "A sighting.", assumptions: [] },
      ],
    });
    draw();
    await screen.findByRole("heading", { name: "The depot", level: 2 });
    await userEvent.keyboard("4");
    await waitFor(() => expect(screen.getByText("The driver left early.")).toBeInTheDocument());
    expect(screen.queryByText(/most likely|leading|score/i)).not.toBeInTheDocument();
  });
});

// §24: "The Detective should answer by navigating the dossier, not merely
// generating text." A command moves to a record; the record says what it says.
describe("commanding the broadcast", () => {
  async function say(phrase: string) {
    await userEvent.type(screen.getByLabelText("Type a command"), `${phrase}{Enter}`);
  }

  const SOURCES = [
    { id: "s1", kind: "official_record", title: "Gate log", retrieved_from: "x", retrieved_at: "y", content_hash: null, reference: 3 },
    { id: "s2", kind: "testimony", title: "Depot supervisor", retrieved_from: "x", retrieved_at: "y", content_hash: null, reference: 14 },
  ];

  it("opens the source that was named", async () => {
    listSources.mockResolvedValue({ ok: true, data: SOURCES });
    draw();
    await screen.findByRole("heading", { name: "The depot", level: 2 });
    await say("open source fourteen");
    expect(await screen.findByText("Depot supervisor")).toBeInTheDocument();
    expect(screen.queryByText("Gate log")).not.toBeInTheDocument();
  });

  it("shows both when two are compared", async () => {
    listSources.mockResolvedValue({ ok: true, data: SOURCES });
    draw();
    await screen.findByRole("heading", { name: "The depot", level: 2 });
    await say("compare sources three and fourteen");
    expect(await screen.findByText("Gate log")).toBeInTheDocument();
    expect(screen.getByText("Depot supervisor")).toBeInTheDocument();
  });

  // Showing the list unchanged would read as a mishearing, and the operator
  // says it again, louder.
  it("says when a named source is not in the case", async () => {
    listSources.mockResolvedValue({ ok: true, data: SOURCES });
    draw();
    await screen.findByRole("heading", { name: "The depot", level: 2 });
    await say("open source ninety nine");
    expect(await screen.findByText(/SOURCE 099 is not in this case/)).toBeInTheDocument();
  });

  it("moves between panels on a spoken command", async () => {
    listClaims.mockResolvedValue({
      ok: true,
      data: [{ id: "c1", statement: "The van left before nine.", status: "claim", asserted_by: null }],
    });
    draw();
    await screen.findByRole("heading", { name: "The depot", level: 2 });
    await say("show the timeline");
    expect(await screen.findByText(/No events in this case yet/)).toBeInTheDocument();
    await say("show the claims");
    expect(await screen.findByText("The van left before nine.")).toBeInTheDocument();
  });
});
