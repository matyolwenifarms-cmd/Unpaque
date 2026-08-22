import { useState } from "react";
import { createClaim, type ClaimRow } from "@/lib/detective-api.ts";

export function AddClaim({
  caseId,
  onAdded,
}: {
  caseId: string;
  onAdded: (claim: ClaimRow) => void;
}) {
  const [statement, setStatement] = useState("");
  const [assertedBy, setAssertedBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (statement.trim() === "" || busy) return;
    setBusy(true);
    setProblem("");
    const result = await createClaim(caseId, { statement, assertedBy });
    setBusy(false);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    onAdded(result.data);
    setStatement("");
    setAssertedBy("");
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-rule bg-raised p-4">
      <h5 className="mb-3 text-sm font-medium">Add a claim</h5>

      <label htmlFor="claim-statement" className="mb-1 block text-xs text-muted">
        What is asserted?
      </label>
      <textarea
        id="claim-statement"
        rows={2}
        value={statement}
        onChange={(event) => setStatement(event.target.value)}
        className="mb-3 w-full resize-y rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
      />

      <label htmlFor="claim-by" className="mb-1 block text-xs text-muted">
        Who or what asserts it?
      </label>
      <input
        id="claim-by"
        value={assertedBy}
        onChange={(event) => setAssertedBy(event.target.value)}
        className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
      />

      {/* No status field, on purpose. A claim arrives unknown and is moved by
          evidence, not by whoever typed it — otherwise "corroborated" becomes
          something you can assert about your own claim. */}
      <p className="mb-3 text-xs text-muted">
        It will be recorded as <span className="font-medium">unknown</span>. Only evidence moves it
        from there.
      </p>

      <button
        type="submit"
        disabled={statement.trim() === "" || busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
      >
        {busy ? "Adding" : "Add claim"}
      </button>
      {problem && <p className="mt-2 text-sm" role="alert">{problem}</p>}
    </form>
  );
}
