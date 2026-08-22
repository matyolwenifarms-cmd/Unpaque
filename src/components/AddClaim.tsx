import { useState } from "react";
import { TEXT_LIMITS, textProblem } from "@shared/detective/limits.ts";
import { LimitedField } from "@/components/LimitedField.tsx";
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

  // See AddSource: the length has to stop the submit, not just annotate the
  // field, or a paste still reaches the database and comes back as a constraint
  // name.
  const tooLong = textProblem(statement, TEXT_LIMITS.claimStatement);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (statement.trim() === "" || tooLong !== null || busy) return;
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

      {/* The long field, and where the full account belongs. An event carries
          a label for the timeline; what a source actually says is a claim. */}
      <LimitedField
        id="claim-statement"
        limit="claimStatement"
        label="What is asserted?"
        rows={3}
        value={statement}
        onChange={setStatement}
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
        disabled={statement.trim() === "" || tooLong !== null || busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
      >
        {busy ? "Adding" : "Add claim"}
      </button>
      {problem && <p className="mt-2 text-sm" role="alert">{problem}</p>}
    </form>
  );
}
