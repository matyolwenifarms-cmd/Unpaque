// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const searchReferences = vi.fn();
const checkDois = vi.fn(async () => ({ status: "ok" as const, checks: [], total: 0 }));
vi.mock("@/lib/research-api.ts", () => ({
  searchReferences: (...args: unknown[]) => searchReferences(...args),
  checkDois: (...args: unknown[]) => checkDois(...(args as [])),
}));

const { default: Research } = await import("./Research.tsx");

/**
 * Render, and get to the literature stage.
 *
 * The page opens on Proposal now — the one screen that asks nothing of
 * somebody who has not used this before. Every test below that was written
 * when literature was the first thing rendered has to say so.
 */
async function openLiterature(user: ReturnType<typeof userEvent.setup>) {
  render(<Research />);
  // The stage list is a disclosure now, closed until a study is open. The
  // buttons are in the DOM either way, so this only has to reach them.
  await user.click(screen.getByRole("button", { name: /^Literature/ }));
}

async function search(term = "framing theory") {
  const user = userEvent.setup();
  await openLiterature(user);
  await user.type(screen.getByLabelText(/what are you looking for/i), term);
  await user.click(screen.getByRole("button", { name: /^search$/i }));
}

describe("the search page", () => {
  beforeEach(() => searchReferences.mockReset());

  it("will not search on fewer than three characters", async () => {
    const user = userEvent.setup();
    await openLiterature(user);
    await user.type(screen.getByLabelText(/what are you looking for/i), "ab");
    expect(screen.getByRole("button", { name: /^search$/i })).toBeDisabled();
  });

  it("passes a four-digit year through as a filter and ignores anything else", async () => {
    searchReferences.mockResolvedValue({ status: "ok", references: [], reportedTotal: 0, notes: [] });
    const user = userEvent.setup();
    await openLiterature(user);
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
    await openLiterature(user);
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
    await openLiterature(user);
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

});

describe("the two stages", () => {
  // Opening on Proposal is the point of that stage: it is the only one that
  // asks nothing of a researcher who does not yet know what this product is.
  it("opens on the proposal stage", async () => {
    render(<Research />);
    expect(screen.getByText(/Hand over your proposal/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/what are you looking for/i)).toBeNull();
  });

  it("switches from literature to the data workspace", async () => {
    const user = userEvent.setup();
    await openLiterature(user);
    expect(screen.getByLabelText(/what are you looking for/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /analyse data/i }));
    expect(screen.getByLabelText(/data file/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/what are you looking for/i)).toBeNull();
  });

  // The file is read in the browser and posted nowhere. A researcher cannot
  // see that, so the only reason to believe it is that the page says so.
  it("says the file is not uploaded", async () => {
    const user = userEvent.setup();
    render(<Research />);
    await user.click(screen.getByRole("button", { name: /analyse data/i }));
    expect(screen.getByText(/read in this browser and is not uploaded/i)).toBeInTheDocument();
  });

  // House rule: a placeholder must announce itself. This box takes an
  // instruction and nothing carries it out, so it has to say so — a box that
  // silently swallows "write this up" is worse than no box.
  it("says plainly that nothing acts on the instruction box yet", async () => {
    const user = userEvent.setup();
    render(<Research />);
    await user.click(screen.getByRole("button", { name: /analyse data/i }));
    await user.type(screen.getByLabelText(/further instructions/i), "Write this up in APA style.");
    expect(screen.getByText(/Nothing acts on this yet/i)).toBeInTheDocument();
    expect(screen.getByText(/not sent anywhere/i)).toBeInTheDocument();
    // Narrowed as the feature grew: the results section is written, so the
    // disclosure now names the discussion as the part that needs a model
    // rather than claiming nothing works.
    expect(screen.getByText(/the discussion, and that needs one/i)).toBeInTheDocument();
  });
});

describe("the method stage", () => {
  it("is reachable and offers the vocabulary", async () => {
    const user = userEvent.setup();
    render(<Research />);
    await user.click(screen.getByRole("button", { name: /^method/i }));
    expect(screen.getByLabelText(/choose a paradigm/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/choose an analytic approach/i)).toBeInTheDocument();
    // And the literature stage is gone, not merely scrolled past.
    expect(screen.queryByLabelText(/what are you looking for/i)).toBeNull();
  });
});

// The stages own their own state, and the write-up transcribes four of them.
// If a callback stops firing the write-up quietly reports "not written yet"
// about work the researcher can see on the previous screen, which reads as
// data loss.
describe("the write-up, assembled from the other stages", () => {
  beforeEach(() => searchReferences.mockReset());

  it("says nothing is written when nothing has been done", async () => {
    const user = userEvent.setup();
    render(<Research />);
    await user.click(screen.getByRole("button", { name: /^Write up/ }));
    expect(screen.getByText(/0 of 9 sections are assembled/)).toBeInTheDocument();
    expect(screen.getByText(/4 are waiting on work not done yet/)).toBeInTheDocument();
  });

  it("transcribes a methodology declared on the Method stage", async () => {
    const user = userEvent.setup();
    render(<Research />);
    await user.click(screen.getByRole("button", { name: /^MethodDeclare/ }));
    await user.selectOptions(screen.getByLabelText(/choose a paradigm/i), "interpretivism");

    await user.click(screen.getByRole("button", { name: /^Write up/ }));
    await waitFor(() =>
      expect(screen.getByText(/1 of 9 sections are assembled/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/interpretivist/)).toBeInTheDocument();
  });

  // The five that nothing here will ever write, on screen as well as in the
  // export.
  it("marks the introduction, literature, discussion, limitations and conclusion as the researcher's", async () => {
    const user = userEvent.setup();
    render(<Research />);
    await user.click(screen.getByRole("button", { name: /^Write up/ }));
    expect(screen.getAllByText("yours to write")).toHaveLength(5);
    expect(screen.getByText(/the one sentence you are answerable for/)).toBeInTheDocument();
  });

  it("lists references found on the Literature stage", async () => {
    searchReferences.mockResolvedValue({
      status: "ok",
      references: [
        {
          id: "r1", source: "openalex", title: "Waiting and trust",
          authors: [{ name: "Jane Smith" }], year: 2021, venue: "Journal of Things",
          preprint: false, retraction: "none", openAccess: true,
          verification: "verified", availability: "metadata_only",
          sources: ["openalex"], caveat: null, quotationCaveat: null,
        },
      ],
      notes: [], reportedTotal: 1,
    });
    const user = userEvent.setup();
    await openLiterature(user);
    await user.type(screen.getByLabelText(/what are you looking for/i), "waiting times");
    await user.click(screen.getByRole("button", { name: /^search$/i }));
    await screen.findByText(/Waiting and trust/);

    await user.click(screen.getByRole("button", { name: /^Write up/ }));
    expect(screen.getByText(/Smith, J\. \(2021\)\./)).toBeInTheDocument();
    expect(screen.getByText(/1 reference, resolved against a bibliographic provider/)).toBeInTheDocument();
  });
});

// The failure this whole lift was meant to prevent: work belonging to one
// study appearing under another's name. Closing a study must empty what was
// loaded from it, and the seeding must not wipe what was loaded.
describe("a study's own work, and nobody else's", () => {
  it("keeps nothing loaded when no study is open", async () => {
    const user = userEvent.setup();
    render(<Research />);
    await user.click(screen.getByRole("button", { name: /^Write up/ }));
    expect(screen.getByText(/0 of 9 sections are assembled/)).toBeInTheDocument();
  });

  // A stored row that will not parse is dropped and counted, never coerced.
  // Nothing here can produce one, so the notice is asserted for its absence:
  // it must not appear when everything read cleanly.
  it("says nothing about dropped records when none were dropped", async () => {
    const user = userEvent.setup();
    render(<Research />);
    await user.click(screen.getByRole("button", { name: /^Write up/ }));
    expect(screen.queryByText(/could not be read back/)).not.toBeInTheDocument();
  });
});
