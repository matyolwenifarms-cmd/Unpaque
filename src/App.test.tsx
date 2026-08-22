// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const useSession = vi.fn();
vi.mock("@/hooks/useSession.ts", () => ({ useSession: () => useSession() }));
vi.mock("@/pages/Unpack.tsx", () => ({ default: () => <h1>Unpack</h1> }));
vi.mock("@/pages/Research.tsx", () => ({ default: () => <h1>Research</h1> }));
vi.mock("@/pages/Cases.tsx", () => ({ default: () => <h1>Detect</h1> }));
vi.mock("@/pages/CaseView.tsx", () => ({ default: () => <h1>A case</h1> }));
vi.mock("@/pages/SignIn.tsx", () => ({ default: () => <h1>Sign in</h1> }));

const { default: App } = await import("./App.tsx");

const draw = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

describe("the shell", () => {
  beforeEach(() => {
    useSession.mockReset().mockReturnValue({ session: null, loading: false, configured: true });
  });

  // The mark belongs on the plate, which is where the logo puts it.
  it("carries no wordmark in the header", () => {
    draw("/unpack");
    const header = document.querySelector("header")!;
    expect(within(header).queryByText(/unpaque/i)).toBeNull();
  });

  it("offers a log in where the wordmark used to be", () => {
    draw("/unpack");
    const header = document.querySelector("header")!;
    expect(within(header).getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/sign-in");
  });

  it("shows who is signed in instead of a log in", () => {
    useSession.mockReturnValue({
      session: { user: { email: "someone@example.org" } }, loading: false, configured: true,
    });
    draw("/unpack");
    const header = document.querySelector("header")!;
    expect(within(header).getByText(/signed in as someone@example\.org/i)).toBeInTheDocument();
    expect(within(header).queryByRole("link", { name: /log in/i })).toBeNull();
  });

  // Repeating them on the landing page would be the same navigation twice on
  // one screen; omitting them everywhere else would strand the reader, because
  // the wordmark that used to lead home is gone.
  it("keeps the feature nav out of the header on the landing page", () => {
    draw("/");
    const header = document.querySelector("header")!;
    expect(within(header).queryByRole("navigation", { name: /features/i })).toBeNull();
  });

  it("puts it in the header everywhere else, with a way home", () => {
    draw("/research");
    const header = document.querySelector("header")!;
    const nav = within(header).getByRole("navigation", { name: /features/i });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Unpack" })).toHaveAttribute("href", "/unpack");
  });

  it("routes each path to its own page", () => {
    for (const [path, heading] of [
      ["/unpack", "Unpack"], ["/research", "Research"],
      ["/cases", "Detect"], ["/sign-in", "Sign in"],
    ] as const) {
      const { unmount } = draw(path);
      expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
      unmount();
    }
  });
});

describe("the palette", () => {
  // Charcoal is unconditional now, so there is no attribute to set and no
  // route that differs. What is worth asserting is that nothing puts one back:
  // a `data-theme` appearing again would mean somebody has reintroduced a
  // second palette, which is what produced two products in one visit.
  it("needs no per-route switching, because there is only one palette", () => {
    for (const path of ["/", "/unpack", "/research", "/cases"]) {
      const { unmount } = draw(path);
      expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
      unmount();
    }
  });
});
