import { useState } from "react";
import { SOURCE_KINDS, type SourceKind } from "@shared/detective/epistemic.ts";
import { TEXT_LIMITS, textProblem } from "@shared/detective/limits.ts";
import { LimitedField } from "@/components/LimitedField.tsx";
import { createSource, type SourceRow } from "@/lib/detective-api.ts";

export function AddSource({
  caseId,
  onAdded,
}: {
  caseId: string;
  onAdded: (source: SourceRow) => void;
}) {
  const [kind, setKind] = useState<SourceKind>("primary_document");
  const [title, setTitle] = useState("");
  const [retrievedFrom, setRetrievedFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  // Length blocks the submit as well as showing in the field. Without this the
  // only thing that notices an over-long paste is Postgres, and it answers with
  // a constraint name rather than a sentence.
  const tooLong = textProblem(title, TEXT_LIMITS.sourceTitle);
  const ready = title.trim() !== "" && retrievedFrom.trim() !== "" && tooLong === null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setProblem("");
    const result = await createSource(caseId, { kind, title, retrievedFrom });
    setBusy(false);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    onAdded(result.data);
    setTitle("");
    setRetrievedFrom("");
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-rule bg-raised p-4">
      <h5 className="mb-3 text-sm font-medium">Add a source</h5>

      <LimitedField
        id="source-title"
        limit="sourceTitle"
        label="What is it?"
        placeholder="Headline, document name, or who gave the account"
        value={title}
        onChange={setTitle}
      />

      <label htmlFor="source-kind" className="mb-1 block text-xs text-muted">Kind</label>
      <select
        id="source-kind"
        value={kind}
        onChange={(event) => setKind(event.target.value as SourceKind)}
        className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
      >
        {SOURCE_KINDS.map((option) => (
          <option key={option} value={option}>{option.replace(/_/g, " ")}</option>
        ))}
      </select>

      {/* Required, and labelled as the thing it is rather than "URL". A source
          whose origin is unrecorded is not evidence of anything, and the
          database refuses one — so the form asks plainly rather than letting
          somebody discover the constraint by hitting it. */}
      <label htmlFor="source-from" className="mb-1 block text-xs text-muted">
        Where did it come from? Required — a source without this is not evidence of anything.
      </label>
      <input
        id="source-from"
        value={retrievedFrom}
        onChange={(event) => setRetrievedFrom(event.target.value)}
        placeholder="a URL, an archive reference, who handed it over and when"
        className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
      />

      <button
        type="submit"
        disabled={!ready || busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
      >
        {busy ? "Adding" : "Add source"}
      </button>
      {problem && <p className="mt-2 text-sm" role="alert">{problem}</p>}
    </form>
  );
}
