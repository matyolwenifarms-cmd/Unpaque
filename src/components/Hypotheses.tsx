import { useMemo, useState } from "react";
import {
  assembleHypotheses,
  discriminatingQuestion,
  discriminators,
  hypothesisProblems,
  type HypothesisDraft,
  type HypothesisEvidence,
} from "@shared/detective/hypothesis.ts";
import { runSkeptic } from "@shared/detective/skeptic.ts";
import { EVIDENCE_CLASSIFICATIONS, type EvidenceClassification } from "@shared/detective/epistemic.ts";
import type { SourceRow } from "@/lib/detective-api.ts";
import { cn } from "@/lib/utils.ts";

export interface HypothesisView extends HypothesisDraft {
  evidence: HypothesisEvidence[];
}

/**
 * Competing explanations, and the Skeptic.
 *
 * The screen makes the module’s two refusals visible rather than hiding them:
 * it will not report on a lone theory, and it ranks nothing. There is no
 * ordering by support and no leading explanation, because a leaderboard of
 * theories is the collapse into truth the epistemic model exists to prevent.
 */
export function Hypotheses({
  drafts,
  evidence,
  sources,
  onAdd,
  onRemove,
  onLink,
  onUnlink,
}: {
  drafts: readonly HypothesisDraft[];
  evidence: readonly HypothesisEvidence[];
  sources: readonly SourceRow[];
  onAdd: (draft: Omit<HypothesisDraft, "id">) => void;
  onRemove: (id: string) => void;
  onLink: (input: {
    hypothesisId: string;
    sourceId: string;
    classification: EvidenceClassification;
    summary: string;
  }) => void;
  onUnlink: (id: string) => void;
}) {
  const outcome = useMemo(() => assembleHypotheses(drafts, evidence), [drafts, evidence]);
  const challenges = useMemo(
    () =>
      outcome.kind === "read"
        ? runSkeptic({
            set: outcome.set,
            sources: sources.map((source) => ({
              id: source.id,
              title: source.title,
              contentHash: source.content_hash,
            })),
          })
        : [],
    [outcome, sources],
  );

  return (
    <div className="space-y-4">
      <AddHypothesis onAdd={onAdd} />

      {outcome.kind === "refused" ? (
        <section className="rounded-lg border border-rule bg-raised p-4">
          <h4 className="text-sm font-medium">Nothing to compare yet</h4>
          <p className="mt-1 text-sm text-muted">{outcome.says}</p>
        </section>
      ) : (
        <>
          {outcome.set.hypotheses.map((hypothesis) => {
            const mine = evidence.filter((item) => item.hypothesisId === hypothesis.id);
            return (
              <article key={hypothesis.id} className="rounded-lg border border-rule bg-raised p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-sm font-medium">{hypothesis.statement}</h4>
                  <button
                    type="button"
                    onClick={() => onRemove(hypothesis.id)}
                    className="shrink-0 text-xs text-muted underline hover:text-ink"
                  >
                    Remove
                  </button>
                </div>

                <p className="mt-2 text-sm text-muted">
                  <span className="text-ink">Would be abandoned if:</span> {hypothesis.falsifier}
                </p>

                {/* Counts, never a score. What is reported is the record. */}
                <p className="mt-2 text-xs text-muted">
                  {hypothesis.supporting.length} supporting from {hypothesis.independentSupport}{" "}
                  independent {hypothesis.independentSupport === 1 ? "source" : "sources"};{" "}
                  {hypothesis.contradicting.length} against.
                </p>

                {!hypothesis.testedAgainst && (
                  <p className="mt-2 text-sm text-muted">
                    Nothing on file bears against this. That may mean a search found nothing, or
                    that none was made — the case file cannot tell those apart.
                  </p>
                )}

                <p className="mt-2 text-xs text-muted">
                  {hypothesis.assumptions.length === 0
                    ? "No assumptions written down."
                    : `Assumes: ${hypothesis.assumptions.join("; ")}`}
                </p>

                {mine.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {mine.map((item) => (
                      <li key={item.id} className="rounded border border-rule bg-paper p-2">
                        <p className="text-xs">
                          <span className="font-medium">{item.classification}</span> —{" "}
                          {item.sourceTitle}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">{item.summary}</p>
                        <button
                          type="button"
                          onClick={() => onUnlink(item.id)}
                          className="mt-1 text-xs text-muted underline hover:text-ink"
                        >
                          Unlink
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <LinkEvidenceToHypothesis
                  hypothesisId={hypothesis.id}
                  sources={sources}
                  onLink={onLink}
                />
              </article>
            );
          })}

          <Separating outcome={outcome} />
          <Skeptic challenges={challenges} />
        </>
      )}
    </div>
  );
}

function Separating({
  outcome,
}: {
  outcome: Extract<ReturnType<typeof assembleHypotheses>, { kind: "read" }>;
}) {
  const pairs: Array<{ key: string; text: string }> = [];
  const { hypotheses, discriminatesNothing } = outcome.set;

  for (let i = 0; i < hypotheses.length; i += 1) {
    for (let j = i + 1; j < hypotheses.length; j += 1) {
      const a = hypotheses[i]!;
      const b = hypotheses[j]!;
      const found = discriminators(a, b);
      if (found.length > 0) {
        pairs.push({
          key: `${a.id}-${b.id}`,
          text: `${found.length} ${found.length === 1 ? "record separates" : "records separate"} "${a.statement}" from "${b.statement}".`,
        });
        continue;
      }
      const question = discriminatingQuestion(a, b);
      if (question) pairs.push({ key: `${a.id}-${b.id}`, text: question });
    }
  }

  if (pairs.length === 0 && discriminatesNothing.length === 0) return null;

  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <h4 className="mb-2 text-sm font-medium">What separates them</h4>
      <ul className="space-y-2">
        {pairs.map((pair) => (
          <li key={pair.key} className="text-sm text-muted">
            {pair.text}
          </li>
        ))}
      </ul>
      {discriminatesNothing.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          {discriminatesNothing.length}{" "}
          {discriminatesNothing.length === 1 ? "record is" : "records are"} consistent with every
          explanation on the table, so {discriminatesNothing.length === 1 ? "it separates" : "they separate"}{" "}
          none of them: {discriminatesNothing.map((item) => item.summary).join("; ")}
        </p>
      )}
    </section>
  );
}

function Skeptic({ challenges }: { challenges: ReturnType<typeof runSkeptic> }) {
  if (challenges.length === 0) return null;
  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <h4 className="text-sm font-medium">The Skeptic</h4>
      {/* Said once, at the top. A reader who takes the unanswered questions for
          findings has been told the opposite of what this panel means. */}
      <p className="mt-1 mb-3 text-xs text-muted">
        The first questions are answered from the case file. The last are not answerable from it,
        and nothing here guesses at them — a confident sentence standing where a judgement belongs
        is the failure this whole feature is against.
      </p>
      <ul className="space-y-3">
        {challenges.map((challenge) => (
          <li key={challenge.id}>
            <p className="text-sm">
              {challenge.question}
              {challenge.kind === "yours" && (
                <span className="ml-2 text-xs text-muted">yours to answer</span>
              )}
            </p>
            {challenge.finding && <p className="mt-1 text-sm text-muted">{challenge.finding}</p>}
            {challenge.kind === "computed" && challenge.finding === null && (
              <p className="mt-1 text-xs text-muted">Nothing in the case file raises this.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AddHypothesis({ onAdd }: { onAdd: (draft: Omit<HypothesisDraft, "id">) => void }) {
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState("");
  const [falsifier, setFalsifier] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const problems = hypothesisProblems({ statement, falsifier });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (problems.length > 0) return;
    onAdd({
      statement: statement.trim(),
      falsifier: falsifier.trim(),
      assumptions: assumptions.split("\n").map((line) => line.trim()).filter(Boolean),
    });
    setStatement("");
    setFalsifier("");
    setAssumptions("");
    setOpen(false);
  }

  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">Explanations</h4>
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          className="rounded-lg border border-rule px-3 py-1.5 text-xs hover:border-accent"
        >
          {open ? "Close" : "State an explanation"}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-3">
          <label htmlFor="hypothesis-statement" className="mb-1 block text-xs text-muted">
            The explanation
          </label>
          <textarea
            id="hypothesis-statement"
            rows={2}
            value={statement}
            onChange={(event) => setStatement(event.target.value)}
            className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />

          <label htmlFor="hypothesis-falsifier" className="mb-1 block text-xs text-muted">
            What would make you abandon it?
          </label>
          <textarea
            id="hypothesis-falsifier"
            rows={2}
            value={falsifier}
            aria-describedby="hypothesis-falsifier-why"
            onChange={(event) => setFalsifier(event.target.value)}
            className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {/* Deliberately not the same sentence the validation gives. Saying it
              twice on one screen reads as a stutter and teaches the reader to
              skip the second copy, which is the one that appears when it
              matters. */}
          <p id="hypothesis-falsifier-why" className="mb-3 mt-1 text-xs text-muted">
            Required. This is the field that makes it a hypothesis rather than a belief.
          </p>

          <label htmlFor="hypothesis-assumptions" className="mb-1 block text-xs text-muted">
            What is it taking for granted? (one per line)
          </label>
          <textarea
            id="hypothesis-assumptions"
            rows={2}
            value={assumptions}
            onChange={(event) => setAssumptions(event.target.value)}
            className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />

          {problems.length > 0 && (
            <ul className="mb-3 space-y-1">
              {problems.map((problem) => (
                <li key={problem.field} className="text-xs text-muted">
                  {problem.says}
                </li>
              ))}
            </ul>
          )}

          <button
            type="submit"
            disabled={problems.length > 0}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            Add explanation
          </button>
        </form>
      )}
    </section>
  );
}

function LinkEvidenceToHypothesis({
  hypothesisId,
  sources,
  onLink,
}: {
  hypothesisId: string;
  sources: readonly SourceRow[];
  onLink: (input: {
    hypothesisId: string;
    sourceId: string;
    classification: EvidenceClassification;
    summary: string;
  }) => void;
}) {
  const [sourceId, setSourceId] = useState("");
  const [classification, setClassification] = useState<EvidenceClassification>("supports");
  const [summary, setSummary] = useState("");

  if (sources.length === 0) {
    return <p className="mt-3 text-xs text-muted">Add a source to the case before linking evidence.</p>;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sourceId === "" || summary.trim() === "") return;
    onLink({ hypothesisId, sourceId, classification, summary });
    setSourceId("");
    setSummary("");
  }

  return (
    <form onSubmit={submit} className="mt-3 border-t border-rule pt-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={sourceId}
          aria-label={`Source bearing on this explanation`}
          onChange={(event) => setSourceId(event.target.value)}
          className="min-w-40 flex-1 rounded-lg border border-rule bg-paper px-3 py-2 text-xs outline-none focus:border-accent"
        >
          <option value="">Choose a source</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.title}
            </option>
          ))}
        </select>
        <select
          value={classification}
          aria-label={`How it bears on this explanation`}
          onChange={(event) => setClassification(event.target.value as EvidenceClassification)}
          className="rounded-lg border border-rule bg-paper px-3 py-2 text-xs outline-none focus:border-accent"
        >
          {EVIDENCE_CLASSIFICATIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <input
        value={summary}
        aria-label={`What the source says`}
        placeholder="What does it say?"
        onChange={(event) => setSummary(event.target.value)}
        className={cn(
          "mt-2 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-xs outline-none",
          "focus:border-accent",
        )}
      />
      <button
        type="submit"
        disabled={sourceId === "" || summary.trim() === ""}
        className="mt-2 rounded-lg border border-rule px-3 py-1.5 text-xs hover:border-accent disabled:opacity-40"
      >
        Link
      </button>
    </form>
  );
}
