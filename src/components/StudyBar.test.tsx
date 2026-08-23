// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StudiesState } from "@/hooks/useStudies.ts";
import { StudyBar } from "./StudyBar.tsx";

const STUDY = {
  id: "s1", title: "Waiting", question: null,
  blind_coding: true, owner_id: "me", created_at: "2026-08-23",
};

function state(over: Partial<StudiesState> = {}): StudiesState {
  return {
    studies: null, invitations: [], studyId: null, study: null,
    userId: null, isOwner: false, problem: null,
    open: vi.fn(), start: vi.fn(), accept: vi.fn(), unblind: vi.fn(),
    ...over,
  };
}

describe("choosing the study every stage works within", () => {
  it("shows nothing at all when there is no project to sign in to", () => {
    const { container } = render(<StudyBar studies={state()} />);
    expect(container.querySelector("section")).toBeNull();
  });

  it("says what a study holds when there are none", () => {
    render(<StudyBar studies={state({ studies: [] })} />);
    expect(screen.getByText(/its transcripts, its codebook, the method you declared/))
      .toBeInTheDocument();
  });

  it("opens a study when it is picked", async () => {
    const open = vi.fn();
    render(<StudyBar studies={state({ studies: [STUDY], open })} />);
    await userEvent.click(screen.getByRole("button", { name: "Waiting" }));
    expect(open).toHaveBeenCalledWith("s1");
  });

  it("offers a way back out of a study, so unsaved work is a deliberate choice", async () => {
    const open = vi.fn();
    render(<StudyBar studies={state({ studies: [STUDY], studyId: "s1", study: STUDY, open })} />);
    await userEvent.click(screen.getByRole("button", { name: "Close study" }));
    expect(open).toHaveBeenCalledWith(null);
  });

  it("will not start a study with no name", async () => {
    const start = vi.fn();
    render(<StudyBar studies={state({ studies: [], start })} />);
    await userEvent.click(screen.getByRole("button", { name: "New study" }));
    expect(screen.getByRole("button", { name: "Start study" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/What is the study called/), "Waiting");
    await userEvent.click(screen.getByRole("button", { name: "Start study" }));
    expect(start).toHaveBeenCalledWith("Waiting", "");
  });

  // An invitation grants nothing until the invited person accepts it from
  // their own session, and they are told what blinding means before they do.
  it("shows an invitation with who sent it and what blind coding means", async () => {
    const accept = vi.fn();
    const invitation = { study_id: "s2", title: "Trust", invited_by_email: "amy@example.org" };
    render(<StudyBar studies={state({ studies: [], invitations: [invitation], accept })} />);
    expect(screen.getByRole("heading", { name: /invited to code “Trust”/ })).toBeInTheDocument();
    expect(screen.getByText(/amy@example.org asked you/)).toBeInTheDocument();
    expect(screen.getByText(/will not see anybody else’s codings while the study is blind/))
      .toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(accept).toHaveBeenCalledWith(invitation);
  });

  it("does not name an inviter it does not know", () => {
    render(<StudyBar studies={state({
      studies: [],
      invitations: [{ study_id: "s2", title: "Trust", invited_by_email: null }],
    })} />);
    expect(screen.getByText(/Somebody asked you/)).toBeInTheDocument();
  });
});
