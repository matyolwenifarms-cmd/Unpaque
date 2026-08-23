// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceCommand } from "./VoiceCommand.tsx";

async function say(phrase: string) {
  await userEvent.type(screen.getByLabelText("Type a command"), `${phrase}{Enter}`);
}

describe("commanding the case file", () => {
  it("passes an understood command on", async () => {
    const onCommand = vi.fn();
    render(<VoiceCommand onCommand={onCommand} />);
    await say("open source fourteen");
    expect(onCommand).toHaveBeenCalledWith({ kind: "open_source", reference: 14 });
  });

  // The commonest failure of a voice interface is mishearing and acting
  // anyway, leaving the operator to work out from the screen what it thought
  // they said.
  it("shows what it heard, whatever it made of it", async () => {
    render(<VoiceCommand onCommand={vi.fn()} />);
    await say("open source fourteen");
    expect(screen.getByText("open source fourteen")).toBeInTheDocument();
  });

  it("shows the refusal beside the transcript", async () => {
    const onCommand = vi.fn();
    render(<VoiceCommand onCommand={onCommand} />);
    await say("who do you think did it");
    expect(screen.getByText("who do you think did it")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/does not answer questions in its own words/);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("says there is nothing to play rather than doing nothing", async () => {
    render(<VoiceCommand onCommand={vi.fn()} />);
    await say("play from one forty two");
    expect(screen.getByRole("status")).toHaveTextContent(/no media to play/);
  });

  // A missing microphone button reads as a bug; the reason is that the browser
  // has no recogniser, and typing does the same thing.
  it("says why there is no microphone when the browser has none", () => {
    render(<VoiceCommand onCommand={vi.fn()} />);
    expect(screen.getByText(/This browser has no speech recognition/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Speak/ })).not.toBeInTheDocument();
  });

  it("offers a microphone when the browser has one", () => {
    // jsdom has no Web Speech API, which is what makes this worth stubbing:
    // the branch is otherwise never taken in any test.
    class Fake {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult = null;
      onerror = null;
      onend = null;
      start() {}
      stop() {}
    }
    vi.stubGlobal("SpeechRecognition", Fake);
    render(<VoiceCommand onCommand={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Speak/ })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  // A closed grammar has to be discoverable, or it is a guessing game.
  it("prints what it understands, and what it will not do", () => {
    render(<VoiceCommand onCommand={vi.fn()} />);
    expect(screen.getByText(/does not answer in its own words/)).toBeInTheDocument();
    expect(screen.getByText(/Open source fourteen/)).toBeInTheDocument();
  });
});
