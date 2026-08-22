import { useState } from "react";
import { Loader2 } from "lucide-react";
import { MAX_INPUT_CHARS, MIN_INPUT_CHARS } from "@shared/diagnostic/analyse.ts";
import type { DiagnosticReport, Mode } from "@shared/diagnostic/report.ts";
import { requestAnalysis } from "@/lib/api.ts";
import { ReportView } from "@/components/ReportView.tsx";
import { cn } from "@/lib/utils.ts";

const MODES: Array<{ id: Mode; label: string; blurb: string }> = [
  { id: "decode", label: "Decode", blurb: "Something you received." },
  { id: "draft", label: "Draft", blurb: "Something you are about to send." },
];

export default function Unpack() {
  const [mode, setMode] = useState<Mode>("decode");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [stub, setStub] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = text.trim().length > 0 && text.trim().length < MIN_INPUT_CHARS;
  const tooLong = text.length > MAX_INPUT_CHARS;
  const submittable = !busy && !tooShort && !tooLong && text.trim().length >= MIN_INPUT_CHARS;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!submittable) return;
    setBusy(true);
    setError(null);
    setReport(null);

    const result = await requestAnalysis(text, mode);
    if (result.status === "ok") {
      setReport(result.report);
      setStub(result.stub);
    } else setError(result.message);
    setBusy(false);
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Unpack</h1>
        <p className="mt-1 text-sm text-muted">
          Communication diagnostics. What is this communication doing?
        </p>
      </header>

      <form onSubmit={onSubmit}>
        <div role="group" aria-label="Mode" className="mb-4 flex gap-2">
          {MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={mode === option.id}
              onClick={() => setMode(option.id)}
              className={cn(
                "flex-1 rounded-lg border px-4 py-3 text-left transition-colors",
                mode === option.id
                  ? "border-accent bg-accent/10"
                  : "border-rule bg-raised hover:border-muted",
              )}
            >
              <span className="block font-medium">{option.label}</span>
              <span className="block text-sm text-muted">{option.blurb}</span>
            </button>
          ))}
        </div>

        <label htmlFor="text" className="sr-only">
          Text to analyse
        </label>
        <textarea
          id="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          placeholder={
            mode === "decode"
              ? "Paste the email, statement or message you want read."
              : "Paste what you are about to send."
          }
          className="w-full resize-y rounded-lg border border-rule bg-raised p-4 leading-relaxed outline-none focus:border-accent"
        />

        <div className="mt-2 flex items-center justify-between text-sm">
          <span className={cn("text-muted", tooLong && "text-accent")}>
            {text.length.toLocaleString("en-GB")} / {MAX_INPUT_CHARS.toLocaleString("en-GB")}
          </span>
          <button
            type="submit"
            disabled={!submittable}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-ink disabled:opacity-40"
          >
            {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
            {busy ? "Reading the structure" : "Analyse"}
          </button>
        </div>

        {tooShort && (
          <p className="mt-2 text-sm text-muted">
            A little more — under {MIN_INPUT_CHARS} characters there is not enough structure to
            report on honestly.
          </p>
        )}
      </form>

      <div className="mt-8" aria-live="polite">
        {error && (
          <div className="rounded-lg border border-rule bg-raised p-5">
            <p className="leading-relaxed">{error}</p>
          </div>
        )}
        {report && stub && (
          // Loud on purpose. The one failure this mode can cause is somebody
          // reading fixed text as an analysis of what they pasted, so the
          // disclosure sits above the report rather than beneath it.
          <div className="mb-4 rounded-lg border-2 border-accent bg-accent/10 p-4">
            <p className="font-semibold">Stub mode — this is not an analysis.</p>
            <p className="mt-1 text-sm leading-relaxed">
              Unpack did not read your text. This is fixed example content, returned so the
              interface can be checked without spending on a model call. Set a real{" "}
              <code className="rounded bg-paper px-1">UNPAQUE_MODEL</code> to analyse anything.
            </p>
          </div>
        )}
        {report && <ReportView report={report} />}
      </div>

      <footer className="mt-12 border-t border-rule pt-5 text-sm leading-relaxed text-muted">
        <p>
          Unpack describes structure. It does not tell you what anyone thinks, feels or intended,
          and it does not judge whether something is true. You interpret; it explains.
        </p>
      </footer>
    </div>
  );
}
