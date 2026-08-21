// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const signInWithOtp = vi.fn();
const signOut = vi.fn();
const useSession = vi.fn();

vi.mock("@/lib/supabase.ts", () => ({
  isConfigured: true,
  supabase: () => ({ auth: { signInWithOtp, signOut } }),
}));
vi.mock("@/hooks/useSession.ts", () => ({ useSession: () => useSession() }));

const { default: SignIn } = await import("./SignIn.tsx");

const draw = () => render(<MemoryRouter><SignIn /></MemoryRouter>);

describe("signing in", () => {
  beforeEach(() => {
    signInWithOtp.mockReset().mockResolvedValue({ error: null });
    signOut.mockReset();
    useSession.mockReturnValue({ session: null, loading: false, configured: true });
  });

  it("asks for an email and sends a link", async () => {
    const user = userEvent.setup();
    draw();
    await user.type(screen.getByLabelText(/email/i), "someone@example.org");
    await user.click(screen.getByRole("button", { name: /send a sign-in link/i }));
    await waitFor(() => expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "someone@example.org" }),
    ));
  });

  // The confirmation must not reveal whether the address has an account. For an
  // investigative tool, a form that answers "who is a user here" is a real
  // problem rather than a theoretical one.
  it("says the same thing whether or not the address has an account", async () => {
    const user = userEvent.setup();
    draw();
    await user.type(screen.getByLabelText(/email/i), "someone@example.org");
    await user.click(screen.getByRole("button", { name: /send a sign-in link/i }));
    // Matched as a fragment, not the whole sentence: the address sits in its
    // own span, so the surrounding text is two nodes rather than one.
    await waitFor(() => {
      expect(screen.getByText(/can sign in, a link is on its way/i)).toBeInTheDocument();
    });
    const page = document.body.textContent ?? "";
    expect(page).not.toMatch(/no account|not registered|unknown email|already/i);
  });

  it("warns that the link signs you in where it is opened", async () => {
    const user = userEvent.setup();
    draw();
    await user.type(screen.getByLabelText(/email/i), "someone@example.org");
    await user.click(screen.getByRole("button", { name: /send a sign-in link/i }));
    await waitFor(() => expect(screen.getByText(/open it on this device/i)).toBeInTheDocument());
  });

  it("shows the service's own words when sending fails", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "Email rate limit exceeded" } });
    const user = userEvent.setup();
    draw();
    await user.type(screen.getByLabelText(/email/i), "someone@example.org");
    await user.click(screen.getByRole("button", { name: /send a sign-in link/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/rate limit/i));
  });

  it("will not submit an empty address", () => {
    draw();
    expect(screen.getByRole("button", { name: /send a sign-in link/i })).toBeDisabled();
  });

  it("offers a way out when already signed in", async () => {
    useSession.mockReturnValue({
      session: { user: { email: "someone@example.org" } },
      loading: false,
      configured: true,
    });
    const user = userEvent.setup();
    draw();
    expect(screen.getByText(/someone@example.org/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });
});
