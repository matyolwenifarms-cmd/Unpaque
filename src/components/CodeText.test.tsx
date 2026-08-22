// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CodeText } from "./CodeText.tsx";

const ONE = "The cost was the first thing everyone mentioned, and nobody trusted the process.";

async function addTranscript(text: string, name: string) {
  await userEvent.click(screen.getByRole("button", { name: /Paste one/ }));
  await userEvent.type(screen.getByLabelText(/Name it/), name);
  await userEvent.type(screen.getByLabelText("The transcript"), text);
  await userEvent.click(screen.getByRole("button", { name: "Add transcript" }));
}

async function addCode(label: string, exclusion: string | null) {
  await userEvent.click(screen.getByRole("button", { name: "New code" }));
  await userEvent.type(screen.getByLabelText("Name"), label);
  await userEvent.type(screen.getByLabelText("Definition"), `Where a participant speaks about ${label}.`);
  await userEvent.type(screen.getByLabelText("Apply when"), `Any passage about ${label}.`);
  if (exclusion !== null) await userEvent.type(screen.getByLabelText("Not when"), exclusion);
}

describe("the qualitative workspace", () => {
  it("says plainly that nothing is saved", () => {
    render(<CodeText />);
    expect(screen.getByText(/Nothing here is saved yet/)).toBeInTheDocument();
  });

  it("offers no coding surface until there is a transcript", () => {
    render(<CodeText />);
    expect(screen.queryByRole("button", { name: /Code$/ })).not.toBeInTheDocument();
    expect(screen.getByText(/An interview transcript/)).toBeInTheDocument();
  });

  // The one departure from how most tools do this: the exclusion is required,
  // and the form says what it is for rather than only refusing.
  it("will not add a code without saying when not to apply it", async () => {
    render(<CodeText />);
    await addTranscript(ONE, "P1");
    await addCode("cost", null);

    const add = screen.getByRole("button", { name: "Add code" });
    expect(add).toBeDisabled();
    expect(screen.getByText(/Two coders disagreeing with nothing in the codebook/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Not when"), "Not a passing mention.");
    expect(add).toBeEnabled();
    await userEvent.click(add);
    expect(screen.getByText(/0 extracts/)).toBeInTheDocument();
  });

  it("reads saturation in the order transcripts were added, and never declares it reached", async () => {
    render(<CodeText />);
    await addTranscript(ONE, "P1");
    await userEvent.click(screen.getByRole("button", { name: /^Saturation/ }));
    expect(screen.getByText(/No codes have been applied yet/)).toBeInTheDocument();
    expect(screen.queryByText(/saturation was reached/i)).not.toBeInTheDocument();
  });
});
