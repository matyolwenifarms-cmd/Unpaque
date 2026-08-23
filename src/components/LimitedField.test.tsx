// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TEXT_LIMITS } from "@shared/detective/limits.ts";
import type { SourceRow } from "@/lib/detective-api.ts";

const createEvent = vi.fn();
const createClaim = vi.fn();
const createSource = vi.fn();
vi.mock("@/lib/detective-api.ts", () => ({
  createEvent: (...a: unknown[]) => createEvent(...a),
  createClaim: (...a: unknown[]) => createClaim(...a),
  createSource: (...a: unknown[]) => createSource(...a),
}));

const { AddEvent } = await import("./AddEvent.tsx");
const { AddClaim } = await import("./AddClaim.tsx");

const SOURCES: SourceRow[] = [
  {
    id: "s1",
    title: "Media report",
    kind: "reporting",
    retrieved_from: "https://example.org",
    retrieved_at: "2026-08-21T09:00:00Z", content_hash: null, reference: 1,
  },
];

// The reported failure: a paragraph of a news report pasted into a field that
// holds a 300-character label, answered by Postgres with
// `new row for relation "events" violates check constraint "events_label_check"`.
const PARAGRAPH =
  "The incident occurred at about 6.30pm, with the 38-year-old Tete declared dead at the scene. " +
  "A case of murder has been opened and no arrests have been made. Police said they were following " +
  "several leads and appealed for anybody with information to come forward, adding that the motive " +
  "remains unclear and that a formal identification is still to take place at the mortuary.";

describe("a field that knows what the database will take", () => {
  beforeEach(() => {
    createEvent.mockReset().mockResolvedValue({ ok: true, data: { id: "e1" } });
    createClaim.mockReset().mockResolvedValue({ ok: true, data: { id: "c1" } });
  });

  it("keeps the whole paste rather than truncating it silently", async () => {
    const user = userEvent.setup();
    render(<AddEvent caseId="k1" sources={SOURCES} onAdded={() => {}} />);
    const field = screen.getByLabelText(/what happened/i);
    await user.click(field);
    await user.paste(PARAGRAPH);
    // Silently keeping the first 300 characters would look like it worked and
    // record half an account. That is worse than the error it replaces.
    expect((field as HTMLTextAreaElement | HTMLInputElement).value).toBe(PARAGRAPH);
  });

  it("says how long it is, how long it may be, and how much to cut", async () => {
    const user = userEvent.setup();
    render(<AddEvent caseId="k1" sources={SOURCES} onAdded={() => {}} />);
    await user.click(screen.getByLabelText(/what happened/i));
    await user.paste(PARAGRAPH);
    const over = PARAGRAPH.trim().length - TEXT_LIMITS.eventLabel.max;
    await waitFor(() =>
      expect(screen.getByText(new RegExp(`trim ${over}`))).toBeInTheDocument(),
    );
  });

  // Every other field is filled, so length is the only thing that can be
  // holding this back. An earlier version of this test left the date empty and
  // passed with the length guard deleted — it was asserting that an incomplete
  // form does not submit, which was never in doubt.
  it("does not let it reach the database", async () => {
    const user = userEvent.setup();
    render(<AddEvent caseId="k1" sources={SOURCES} onAdded={() => {}} />);
    await user.click(screen.getByLabelText(/what happened/i));
    await user.paste(PARAGRAPH);
    await user.selectOptions(screen.getByLabelText(/from which source/i), "s1");
    await user.type(screen.getByLabelText(/^when/i), "2026-08-21T18:30");
    await user.click(screen.getByRole("button", { name: /add event/i }));
    expect(createEvent).not.toHaveBeenCalled();
  });

  // The counterpart. A guard that refuses everything is not a guard.
  it("lets a label that fits straight through", async () => {
    const user = userEvent.setup();
    render(<AddEvent caseId="k1" sources={SOURCES} onAdded={() => {}} />);
    await user.type(screen.getByLabelText(/what happened/i), "Shot fired outside the venue");
    await user.selectOptions(screen.getByLabelText(/from which source/i), "s1");
    await user.type(screen.getByLabelText(/^when/i), "2026-08-21T18:30");
    await user.click(screen.getByRole("button", { name: /add event/i }));
    await waitFor(() => expect(createEvent).toHaveBeenCalled());
  });

  it("shows no counter on a field nobody has filled", () => {
    render(<AddEvent caseId="k1" sources={SOURCES} onAdded={() => {}} />);
    expect(screen.queryByText(new RegExp(`of ${TEXT_LIMITS.eventLabel.max}`))).toBeNull();
  });

  // The event label is short because the timeline prints it. The account
  // itself goes in a claim, which holds 2000 characters — so the same
  // paragraph must be accepted there.
  it("accepts the same paragraph as a claim", async () => {
    const user = userEvent.setup();
    render(<AddClaim caseId="k1" onAdded={() => {}} />);
    await user.click(screen.getByLabelText(/what is asserted/i));
    await user.paste(PARAGRAPH);
    await user.click(screen.getByRole("button", { name: /add claim/i }));
    await waitFor(() => expect(createClaim).toHaveBeenCalled());
  });
});
