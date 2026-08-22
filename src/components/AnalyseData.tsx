import { useMemo, useState } from "react";
import { Play } from "lucide-react";
import type { Dataset } from "@shared/research/analytics/dataset.ts";
import {
  availableFor,
  run,
  type ProcedureId,
} from "@shared/research/analytics/procedures.ts";
import type { Finding } from "@shared/research/analytics/result.ts";
import { DESIGN_KINDS, checkCausalClaim, type Design, type DesignKind } from "@shared/research/analytics/causal.ts";
import { FindingView } from "@/components/FindingView.tsx";
import { cn } from "@/lib/utils.ts";

/**
 * Choose two columns, choose a procedure, read the finding.
 *
 * The procedure list is derived from the two columns rather than offered
 * whole, and the ones that do not fit stay visible with their reason. A greyed
 * option teaches nothing; "arm has 3 levels, a t-test compares exactly two"
 * teaches the rule at the moment it matters.
 *
 * The design is declared before anything runs, because it is what decides
 * whether the write-up may say "causes" — and asking afterwards would mean
 * asking somebody to revise a conclusion they have already formed.
 */
export function AnalyseData({ dataset }: { dataset: Dataset }) {
  const usable = dataset.columns.filter((column) => column.kind !== "empty");
  const [aName, setA] = useState("");
  const [bName, setB] = useState("");
  const [procedure, setProcedure] = useState<ProcedureId | "">("");
  const [comparisons, setComparisons] = useState("1");
  const [designKind, setDesignKind] = useState<DesignKind>("correlational");
  const [randomised, setRandomised] = useState(false);
  const [strategy, setStrategy] = useState("");
  const [finding, setFinding] = useState<Finding | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const a = usable.find((column) => column.name === aName) ?? null;
  const b = usable.find((column) => column.name === bName) ?? null;
  const options = useMemo(() => availableFor(a, b), [a, b]);
  const chosen = options.find((option) => option.procedure.id === procedure);

  const design: Design = {
    kind: designKind,
    randomised,
    ...(strategy.trim() ? { identificationStrategy: strategy.trim() } : {}),
  };

  function onRun() {
    setProblem(null);
    setFinding(null);
    if (!procedure || !a || !b) return;
    const count = Number.parseInt(comparisons, 10);
    const outcome = run(dataset, procedure, a.name, b.name, {
      comparisons: Number.isFinite(count) && count > 0 ? count : 1,
    });
    if (outcome.ok) setFinding(outcome.finding);
    else setProblem("reason" in outcome ? outcome.reason : "That procedure could not run.");
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="choose" className="rounded-lg border border-rule bg-raised p-5">
        <h3 id="choose" className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
          Choose what to compare
        </h3>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Picker id="column-a" label="First column" value={aName} onChange={setA} columns={usable} />
          <Picker id="column-b" label="Second column" value={bName} onChange={setB} columns={usable} />
        </div>

        <fieldset className="mb-4">
          <legend className="mb-2 text-xs uppercase tracking-wider text-muted">Procedure</legend>
          <ul className="space-y-2">
            {options.map(({ procedure: option, available, whyNot }) => (
              <li key={option.id}>
                <label
                  className={cn(
                    "block rounded-lg border px-4 py-3 transition-colors",
                    available
                      ? procedure === option.id
                        ? "cursor-pointer border-accent bg-accent/10"
                        : "cursor-pointer border-rule hover:border-muted"
                      : "border-rule opacity-60",
                  )}
                >
                  {/* aria-label, not the wrapping text. Without it the radio's
                      accessible name is the whole block — heading, question and
                      the reason it cannot run — so a screen reader announces
                      three sentences to say which option this is. The question
                      and the reason are attached as a description instead,
                      which is where a control's supporting text belongs. */}
                  <input
                    type="radio"
                    name="procedure"
                    value={option.id}
                    aria-label={option.name}
                    aria-describedby={`procedure-${option.id}-detail`}
                    disabled={!available}
                    checked={procedure === option.id}
                    onChange={() => setProcedure(option.id)}
                    className="sr-only"
                  />
                  <span className="block font-medium">{option.name}</span>
                  <span id={`procedure-${option.id}-detail`}>
                    <span className="block text-sm text-muted">{option.question}</span>
                    {/* The reason stays on screen. This is where somebody learns
                        that a t-test compares exactly two groups. */}
                    {!available && whyNot && (
                      <span className="mt-1 block text-sm text-accent">{whyNot}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="comparisons" className="mb-1 block text-xs uppercase tracking-wider text-muted">
              Tests in this family
            </label>
            <input
              id="comparisons"
              value={comparisons}
              inputMode="numeric"
              onChange={(event) => setComparisons(event.target.value)}
              className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
            />
            <p className="mt-1 text-xs text-muted">
              How many tests you are running on this data altogether. It changes what the p means,
              not what it is.
            </p>
          </div>

          <div>
            <label htmlFor="design" className="mb-1 block text-xs uppercase tracking-wider text-muted">
              Design
            </label>
            <select
              id="design"
              value={designKind}
              onChange={(event) => setDesignKind(event.target.value as DesignKind)}
              className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
            >
              {DESIGN_KINDS.map((kind) => (
                <option key={kind} value={kind}>{kind.replace(/_/g, "-")}</option>
              ))}
            </select>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={randomised}
                onChange={(event) => setRandomised(event.target.checked)}
              />
              Participants were randomly allocated
            </label>
          </div>
        </div>

        {!randomised && (
          <div className="mb-4">
            <label htmlFor="strategy" className="mb-1 block text-xs uppercase tracking-wider text-muted">
              What licenses a causal reading, if anything
            </label>
            <input
              id="strategy"
              value={strategy}
              onChange={(event) => setStrategy(event.target.value)}
              placeholder="an instrument, a discontinuity, a defended counterfactual — or leave empty"
              className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
            />
            <p className="mt-1 text-xs text-muted">
              Left empty, the write-up will be held to association rather than cause. That is the
              default because it is usually right.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onRun}
          disabled={!chosen?.available}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-ink disabled:opacity-40"
        >
          <Play aria-hidden className="h-4 w-4" />
          Run it
        </button>
        {problem && (
          <p role="alert" className="mt-3 text-sm text-destructive">{problem}</p>
        )}
      </section>

      {finding && <FindingView finding={finding} />}
      {finding && <Interpretation design={design} />}
    </div>
  );
}

/**
 * Where the researcher writes what they think it means, checked against the
 * design that produced it.
 *
 * Checked as they type rather than on submit. The point is not to catch a
 * finished sentence — it is that somebody writing "screen time reduced
 * wellbeing" sees, in the moment, that the design they declared cannot carry
 * it. Afterwards is too late: by then it is a conclusion, and people defend
 * conclusions.
 */
function Interpretation({ design }: { design: Design }) {
  const [text, setText] = useState("");
  const outcome = checkCausalClaim(text, design);

  return (
    <section aria-labelledby="interpretation" className="rounded-lg border border-rule bg-raised p-5">
      <h3 id="interpretation" className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
        What you take it to mean
      </h3>
      <p className="mb-3 text-sm text-muted">
        For the discussion section. Checked against the design above as you write.
      </p>
      <textarea
        aria-label="Interpretation"
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Participants who reported more of X also reported more of Y…"
        className={cn(
          "w-full resize-y rounded-lg border bg-paper px-3 py-2 outline-none focus:border-accent",
          outcome.ok ? "border-rule" : "border-accent",
        )}
      />
      {!outcome.ok && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-accent">{outcome.says}</p>
      )}
    </section>
  );
}

function Picker({
  id,
  label,
  value,
  onChange,
  columns,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  columns: Dataset["columns"];
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs uppercase tracking-wider text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
      >
        <option value="">Choose…</option>
        {columns.map((column) => (
          <option key={column.name} value={column.name}>
            {column.name} ({column.kind})
          </option>
        ))}
      </select>
    </div>
  );
}
