// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Timeline } from "./Timeline.tsx";
import type { EventRow, SourceRow } from "@/lib/detective-api.ts";

const sources: SourceRow[] = [
  { id: "s1", kind: "testimony", title: "A statement", retrieved_from: "transcript", retrieved_at: "x", content_hash: null },
  { id: "s2", kind: "video", title: "CCTV footage", retrieved_from: "operator export", retrieved_at: "x", content_hash: null },
];

const event = (over: Partial<EventRow> & { id: string }): EventRow => ({
  source_id: "s1",
  label: "An event",
  occurred_at: "2026-06-14T20:00:00Z",
  certainty: "claimed",
  origin: "account",
  tolerance_minutes: null,
  moment: null,
  ...over,
});

// The specification's worked example.
const statement = event({
  id: "e1", source_id: "s1", label: "Says they left Location X",
  occurred_at: "2026-06-14T20:00:00Z", certainty: "claimed", origin: "account",
  moment: "leaving Location X",
});
const cctv = event({
  id: "e2", source_id: "s2", label: "Vehicle appears at Location X",
  occurred_at: "2026-06-14T20:37:00Z", certainty: "confirmed", origin: "recording",
  moment: "leaving Location X",
});

describe("the timeline", () => {
  it("says what to do when there is nothing on it", () => {
    render(<Timeline events={[]} sources={sources} />);
    expect(screen.getByText(/the timeline builds itself/i)).toBeInTheDocument();
  });

  it("lists events with their source and how the time was established", () => {
    render(<Timeline events={[statement]} sources={sources} />);
    expect(screen.getByText("Says they left Location X")).toBeInTheDocument();
    expect(screen.getByText(/account/)).toBeInTheDocument();
    expect(screen.getByText(/A statement/)).toBeInTheDocument();
  });

  // An undated event must not be given a time it does not have, and must not
  // sort to the epoch where it appears first and reads as a finding.
  it("says a time is unknown rather than inventing one", () => {
    const undated = event({ id: "e9", label: "A meeting nobody can date", occurred_at: null, certainty: "unknown" });
    render(<Timeline events={[undated]} sources={sources} />);
    expect(screen.getByText(/Time unknown — placed last rather than guessed/)).toBeInTheDocument();
  });
});

describe("a discrepancy on the timeline", () => {
  it("reports the gap between two records of one moment, naming both sources", () => {
    render(<Timeline events={[statement, cctv]} sources={sources} />);
    // Scoped to the discrepancy itself: source names also appear on each
    // timeline row, so an unscoped query is ambiguous rather than wrong.
    const heading = screen.getByText(/Timeline discrepancy — 37 minutes/);
    expect(heading.textContent).toMatch(/A statement/);
    expect(heading.textContent).toMatch(/CCTV footage/);
  });

  // §9's rule, on screen. The heading is the Detective's permanent question;
  // a neutral header over the same list would read as hedging.
  it("asks what else could explain it, and lists what would settle each answer", () => {
    render(<Timeline events={[statement, cctv]} sources={sources} />);
    expect(screen.getByText(/What else could explain this\?/)).toBeInTheDocument();
    expect(screen.getAllByText(/Distinguished by:/).length).toBeGreaterThan(2);
  });

  it("says outright that it concludes nothing about anybody", () => {
    render(<Timeline events={[statement, cctv]} sources={sources} />);
    expect(screen.getByText(/concludes anything about anybody/i)).toBeInTheDocument();
  });

  // The rule §9 states in capitals, checked against everything the page renders.
  it("uses no accusatory word anywhere on the page", () => {
    render(<Timeline events={[statement, cctv]} sources={sources} />);
    const page = (document.body.textContent ?? "").toLowerCase();
    for (const word of ["lied", "lying", "liar", "dishonest", "deceptive", "false statement"]) {
      expect(page).not.toContain(word);
    }
  });

  it("marks the moment collectively conflicting rather than trusting the confirmed record", () => {
    render(<Timeline events={[statement, cctv]} sources={sources} />);
    expect(screen.getByText(/“leaving Location X” — conflicting/)).toBeInTheDocument();
  });

  it("says so when records of one moment agree", () => {
    const close = event({ ...cctv, id: "e3", occurred_at: "2026-06-14T20:05:00Z" });
    render(<Timeline events={[statement, close]} sources={sources} />);
    expect(screen.getByText(/2 records agree/)).toBeInTheDocument();
    expect(screen.queryByText(/Timeline discrepancy/)).not.toBeInTheDocument();
  });

  // Nobody said these describe the same thing, so nothing may be inferred from
  // their times. Manufacturing a conflict here is the failure mode that looks
  // impressive and is worthless.
  it("compares nothing when no moment groups the records", () => {
    render(<Timeline events={[{ ...statement, moment: null }, { ...cctv, moment: null }]} sources={sources} />);
    expect(screen.queryByText(/Timeline discrepancy/)).not.toBeInTheDocument();
  });
});
