import { useState } from "react";
import { EVIDENCE_CLASSIFICATIONS, type EvidenceClassification } from "@shared/detective/epistemic.ts";
import { createEvidence, type EvidenceRow, type SourceRow } from "@/lib/detective-api.ts";

const LABELS: Record<EvidenceClassification, string> = {
  supports: "supports it",
  contradicts: "contradicts it",
  contextualises: "gives it context",
  undermines_source: "undermines the source",
  inconclusive: "is inconclusive",
};

export function LinkEvidence({
  caseId,
  claimId,
  sources,
  onLinked,
}: {
  caseId: string;
  claimId: string;
  sources: SourceRow[];
  onLinked: (evidence: EvidenceRow) => void;
}) {
  const [sourceId, setSourceId] = useState("");
  const [classification, setClassification] = useState<EvidenceClassification>("supports");
  const [excerpt, setExcerpt] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  if (sources.length === 0) {
    return (
      <p className="text-xs text-muted">
        Add a source first — a claim with nothing behind it is not evidence of anything.
      </p>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (sourceId === "" || busy) return;
    setBusy(true);
    setProblem("");
    const result = await createEvidence(caseId, { claimId, sourceId, classification, excerpt });
    setBusy(false);
    if (!result.ok) {
      // The database refuses a second identical link, and that refusal is worth
      // explaining rather than passing through raw: one source counted twice is
      // how a claim comes to look better supported than it is.
      setProblem(
        /duplicate key|unique/i.test(result.message)
          ? "That source already bears on this claim in that way. Counting it twice would make one source look like two."
          : result.message,
      );
      return;
    }
    onLinked(result.data);
    setExcerpt("");
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 rounded-md bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor={`ev-source-${claimId}`} className="sr-only">Source</label>
        <select
          id={`ev-source-${claimId}`}
          value={sourceId}
          onChange={(event) => setSourceId(event.target.value)}
          className="rounded border border-rule bg-raised px-2 py-1.5 outline-none focus:border-accent"
        >
          <option value="">Choose a source…</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>{source.title}</option>
          ))}
        </select>

        <label htmlFor={`ev-class-${claimId}`} className="sr-only">How it bears on the claim</label>
        <select
          id={`ev-class-${claimId}`}
          value={classification}
          onChange={(event) => setClassification(event.target.value as EvidenceClassification)}
          className="rounded border border-rule bg-raised px-2 py-1.5 outline-none focus:border-accent"
        >
          {EVIDENCE_CLASSIFICATIONS.map((option) => (
            <option key={option} value={option}>{LABELS[option]}</option>
          ))}
        </select>
      </div>

      <label htmlFor={`ev-excerpt-${claimId}`} className="mt-2 mb-1 block text-xs text-muted">
        What in the source says so? Quote it, so a reader can check.
      </label>
      <input
        id={`ev-excerpt-${claimId}`}
        value={excerpt}
        onChange={(event) => setExcerpt(event.target.value)}
        className="w-full rounded border border-rule bg-raised px-2 py-1.5 text-sm outline-none focus:border-accent"
      />

      <button
        type="submit"
        disabled={sourceId === "" || busy}
        className="mt-2 rounded border border-rule px-3 py-1.5 text-xs font-medium hover:bg-raised disabled:opacity-40"
      >
        {busy ? "Linking" : "Link evidence"}
      </button>
      {problem && <p className="mt-2 text-xs" role="alert">{problem}</p>}
    </form>
  );
}
