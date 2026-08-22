// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const searchReferences = vi.fn();
vi.mock("@/lib/research-api.ts", () => ({
  searchReferences: (...args: unknown[]) => searchReferences(...args),
}));

const { default: Research } = await import("./Research.tsx");

async function search(term = "framing theory") {
  const user = userEvent.setup();
  render(<Research />);
  await user.type(screen.getByLabelText(/what are you looking for/i), term);
  await user.click(screen.getByRole("button", { name: /^search$/i }));
}

describe("the search page", () => {
  beforeEach(() => searchReferences.mockReset());

  it("will not search on fewer than three characters", async () => {
    const user = userEvent.setup();
    render(<Research />);
    await user.type(screen.getByLabelText(/what are you looking for/i), "ab");
    expect(screen.getByRole("button", { name: /^search$/i })).toBeDisabled();
  });

  it("passes a four-digit year through as a filter and ignores anything else", async () => {
    searchReferences.mockResolvedValue({ status: "ok", references: [], reportedTotal: 0, notes: [] });
    const user = userEvent.setup();
    render(<Research />);
    await user.type(screen.getByLabelText(/what are you looking for/i), "framing");
    await user.type(screen.getByLabelText(/published from year/i), "banana");
    await user.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() =>
      expect(searchReferences).toHaveBeenCalledWith("framing", undefined, "relevance"),
    );
  });

  // Relevance is the default, and the reason is the whole of the bug this
  // control came out of: sorting the merged result set by date does not order
  // the literature, it replaces it.
  it("asks for relevance unless the reader chooses otherwise", async () => {
    searchReferences.mockResolvedValue({ status: "ok", references: [], reportedTotal: 0, notes: [] });
    const user = userEvent.setup();
    render(<Research />);
    await user.type(screen.getByLabelText(/what are you looking for/i), "media framing");
    await user.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() =>
      expect(searchReferences).toHaveBeenCalledWith("media framing", undefined, "relevance"),
    );

    await user.click(screen.getByRole("radio", { name: /newest first/i }));
    await user.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() =>
      expect(searchReferences).toHaveBeenLastCalledWith("media framing", undefined, "recency"),
    );
  });

  // Labelling a list "most relevant first" while it is still sorted by date is
  // the same lie the sort told, retold by a control.
  it("names the ordering the list on screen actually has", async () => {
    searchReferences.mockResolvedValue({
      status: "ok",
      references: [
        {
          id: "doi:10.1000/a", source: "openalex", doi: "10.1000/a", title: "A work",
          authors: [], year: 2020, preprint: false, retraction: "none", openAccess: false,
          verification: "verified", availability: "metadata_only", sources: ["openalex"],
          caveat: null, quotationCaveat: null,
        },
      ],
      reportedTotal: 1,
      notes: [],
    });
    const user = userEvent.setup();
    render(<Research />);
    await user.type(screen.getByLabelText(/what are you looking for/i), "media framing");
    await user.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => expect(screen.getByText(/most relevant first/i)).toBeInTheDocument());

    // Changing the control without searching again must not relabel the list
    // that is already on screen.
    await user.click(screen.getByRole("radio", { name: /newest first/i }));
    expect(screen.getByText(/most relevant first/i)).toBeInTheDocument();
  });

  // The notes are the honest half of this feature. A search that returned less
  // because a provider was down is indistinguishable from a smaller
  // literature, and a reader who must scroll past the list to learn that has
  // already drawn their conclusion.
  it("shows what the search did, above the results", async () => {
    searchReferences.mockResolvedValue({
      status: "ok",
      references: [],
      reportedTotal: 0,
      notes: ["crossref could not be reached (503), so its results are missing."],
    });
    await search();
    await waitFor(() => expect(screen.getByText(/What this search did/)).toBeInTheDocument());
    expect(screen.getByText(/crossref could not be reached/)).toBeInTheDocument();
  });

  it("does not let an empty result read as a thin literature", async () => {
    searchReferences.mockResolvedValue({ status: "ok", references: [], reportedTotal: 0, notes: [] });
    await search();
    await waitFor(() => {
      expect(screen.getByText(/a provider being unreachable looks exactly like this/i))
        .toBeInTheDocument();
    });
  });

  it("shows the service's own words on an error, not a generic failure", async () => {
    searchReferences.mockResolvedValue({
      status: "error",
      code: "rate_limited",
      message: "That is as many searches as one visitor gets this hour.",
    });
    await search();
    await waitFor(() => {
      expect(screen.getByText(/as many searches as one visitor gets this hour/)).toBeInTheDocument();
    });
  });

  it("says references never come from a language model", () => {
    render(<Research />);
    expect(screen.getByText(/never from a language model/i)).toBeInTheDocument();
  });
});
