// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Coders } from "./Coders.tsx";

describe("inviting a second coder", () => {
  it("distinguishes an invitation from somebody actually coding", () => {
    render(
      <Coders
        blind
        coders={[
          { email: "ben@example.org", role: "coder", user_id: "ben", accepted_at: "2026-08-23" },
          { email: "cleo@example.org", role: "coder", user_id: null, accepted_at: null },
        ]}
        onInvite={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("coding")).toBeInTheDocument();
    expect(screen.getByText("invited, not yet accepted")).toBeInTheDocument();
  });

  // Copy that promises an email nobody wrote is the kind of small lie that
  // makes somebody distrust the rest of the screen.
  it("does not claim an email was sent", () => {
    render(<Coders blind coders={[]} onInvite={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/Nothing is emailed to them/)).toBeInTheDocument();
    expect(screen.queryByText(/invitation has been sent/i)).not.toBeInTheDocument();
  });

  it("passes the address on and clears the field", async () => {
    const onInvite = vi.fn().mockResolvedValue(undefined);
    render(<Coders blind coders={[]} onInvite={onInvite} onRemove={vi.fn()} />);
    const field = screen.getByLabelText("Invite by email");
    await userEvent.type(field, "ben@example.org");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(onInvite).toHaveBeenCalledWith("ben@example.org");
    expect(field).toHaveValue("");
  });

  it("says what a second coder is for when there are none", () => {
    render(<Coders blind coders={[]} onInvite={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/seeing none of your codings until you unblind/)).toBeInTheDocument();
  });

  it("says plainly once everybody can see everybody", () => {
    render(
      <Coders
        blind={false}
        coders={[{ email: "ben@example.org", role: "coder", user_id: "ben", accepted_at: "x" }]}
        onInvite={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText(/now sees everybody/)).toBeInTheDocument();
  });
});
