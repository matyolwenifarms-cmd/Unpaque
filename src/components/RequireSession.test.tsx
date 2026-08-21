// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const useSession = vi.fn();
vi.mock("@/hooks/useSession.ts", () => ({ useSession: () => useSession() }));

const { RequireSession } = await import("./RequireSession.tsx");

const draw = () =>
  render(
    <MemoryRouter>
      <RequireSession>
        <p>the protected thing</p>
      </RequireSession>
    </MemoryRouter>,
  );

describe("gating what belongs to a person", () => {
  beforeEach(() => useSession.mockReset());

  it("shows the content to somebody signed in", () => {
    useSession.mockReturnValue({ session: { user: {} }, loading: false, configured: true });
    draw();
    expect(screen.getByText("the protected thing")).toBeInTheDocument();
  });

  // Distinguishing "still checking" from "signed out" is the whole reason
  // `loading` exists: a sign-in form flashed at a returning user for half a
  // second is worse than a moment of nothing.
  it("says it is checking rather than flashing a sign-in form", () => {
    useSession.mockReturnValue({ session: null, loading: true, configured: true });
    draw();
    expect(screen.getByText(/checking your session/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
  });

  it("offers a sign-in link when signed out", () => {
    useSession.mockReturnValue({ session: null, loading: false, configured: true });
    draw();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/sign-in");
    expect(screen.queryByText("the protected thing")).not.toBeInTheDocument();
  });

  it("explains itself in a build with no project attached", () => {
    useSession.mockReturnValue({ session: null, loading: false, configured: false });
    draw();
    expect(screen.getByText(/not connected to an Unpaque project/i)).toBeInTheDocument();
  });
});
