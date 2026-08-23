import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import {
  EXAMPLE_COMMANDS,
  interpret,
  type Command,
  type Interpretation,
} from "@shared/detective/command.ts";
import { cn } from "@/lib/utils.ts";

/**
 * The browser's own speech recognition, if it has one.
 *
 * Typed narrowly rather than pulled from a types package: this is the only
 * part of the Web Speech API used, the interface is not in lib.dom for
 * Firefox's benefit, and a wide `any` here would hide a rename in the two
 * fields that matter.
 */
interface SpeechResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<SpeechResultLike>; resultIndex: number }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function recogniser(): RecognitionLike | null {
  const holder = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  const Recognition = holder.SpeechRecognition ?? holder.webkitSpeechRecognition;
  return Recognition ? new Recognition() : null;
}

/**
 * Voice and typed commands over the case file.
 *
 * Section 24 calls voice a primary interface. What it is here is one of two
 * ways into the same closed grammar — the other is typing, which is what
 * makes it testable and what works in a browser with no recogniser at all.
 *
 * **The interpretation is always shown, including what was heard.** The
 * commonest failure of a voice interface is not mishearing; it is mishearing
 * and acting anyway, leaving the operator to work out from the screen what it
 * thought they said. Every refusal here carries the transcript beside it.
 *
 * Nothing speaks back. Reading a stored record aloud would be honest and is
 * not built; answering a question aloud would mean generating one, which is
 * the thing this whole feature refuses.
 */
export function VoiceCommand({ onCommand }: { onCommand: (command: Command) => void }) {
  const [typed, setTyped] = useState("");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [outcome, setOutcome] = useState<Interpretation | null>(null);
  const [available] = useState(() => typeof window !== "undefined" && recogniser() !== null);
  const active = useRef<RecognitionLike | null>(null);

  useEffect(() => {
    return () => {
      active.current?.stop();
      active.current = null;
    };
  }, []);

  function run(phrase: string) {
    const result = interpret(phrase);
    setOutcome(result);
    if (result.kind === "command") onCommand(result.command);
  }

  function listen() {
    if (listening) {
      active.current?.stop();
      return;
    }
    const recognition = recogniser();
    if (!recognition) return;
    recognition.lang = "en-GB";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const result = event.results[event.resultIndex];
      if (!result) return;
      const transcript = result[0].transcript;
      setHeard(transcript);
      // Only a final result is acted on. An interim one changes as the
      // recogniser revises it, and acting on "open source four" a moment
      // before it becomes "open source forty" opens the wrong record.
      if (result.isFinal) run(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      setListening(false);
      active.current = null;
    };
    active.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h4 className="mr-auto text-sm font-medium">Command</h4>
        {available ? (
          <button
            type="button"
            onClick={listen}
            aria-pressed={listening}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
              listening ? "border-accent bg-accent/10" : "border-rule hover:border-accent",
            )}
          >
            {listening ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
            {listening ? "Listening" : "Speak"}
          </button>
        ) : (
          /* Said rather than hidden. A missing microphone button in Firefox
             reads as a bug; the reason is that the browser has no recogniser,
             and typing does the same thing. */
          <span className="text-xs text-muted">
            This browser has no speech recognition. Type the command instead.
          </span>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (typed.trim() === "") return;
          setHeard(typed);
          run(typed);
          setTyped("");
        }}
      >
        <label htmlFor="voice-command" className="sr-only">
          Type a command
        </label>
        <input
          id="voice-command"
          value={typed}
          placeholder="Open source fourteen"
          onChange={(event) => setTyped(event.target.value)}
          className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </form>

      {heard !== "" && (
        /* The transcript, always, beside whatever was made of it. */
        <p className="mt-3 text-xs text-muted">
          Heard: <span className="text-ink">{heard}</span>
        </p>
      )}

      {outcome !== null && outcome.kind !== "command" && (
        <p className="mt-1 text-sm text-muted" role="status">
          {outcome.says}
        </p>
      )}

      {/* A closed grammar has to be discoverable, or it is a guessing game. */}
      <p className="mt-3 text-xs text-muted">
        It navigates the case file and does not answer in its own words. Try:{" "}
        {EXAMPLE_COMMANDS.map((example) => `$’${example}$’`).join(", ")}.
      </p>
    </section>
  );
}
