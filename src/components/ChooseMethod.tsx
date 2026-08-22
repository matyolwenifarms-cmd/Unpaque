import { useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { PARADIGMS, PARADIGM_IDS, type ParadigmId } from "@shared/research/method/paradigms.ts";
import { THEORIES, THEORY_IDS, type TheoryId } from "@shared/research/method/theories.ts";
import { methodStatement, type MethodDeclaration } from "@shared/research/method/statement.ts";
import { cn } from "@/lib/utils.ts";

/**
 * Declare the method, see what it commits you to, and take the statement away.
 *
 * The order on screen is the order a supervisor asks in: what is your paradigm,
 * what is your analytic approach, how are you sampling, what does your question
 * claim. The tensions appear as the answers arrive rather than on submit —
 * telling somebody afterwards that their frame and their method disagree means
 * telling them after they have committed to both.
 *
 * Nothing blocks. Every tension here is defensible in some study, and a tool
 * that refused a design would be overruling a supervisor it cannot hear.
 */
export function ChooseMethod() {
  const [paradigm, setParadigm] = useState<ParadigmId | "">("");
  const [theory, setTheory] = useState<TheoryId | "">("");
  const [sampling, setSampling] = useState<"" | "statistical" | "purposive">("");
  const [sampleSize, setSampleSize] = useState("");
  const [participants, setParticipants] = useState("");
  const [collection, setCollection] = useState("");
  const [questionType, setQuestionType] =
    useState<"" | "causal" | "associational" | "descriptive" | "exploratory">("");
  const [randomised, setRandomised] = useState(false);
  const [strategy, setStrategy] = useState("");
  const [apriori, setApriori] = useState(false);
  const [claimsSaturation, setClaimsSaturation] = useState(false);
  const [saturationAccount, setSaturationAccount] = useState("");
  const [copied, setCopied] = useState(false);

  const size = Number.parseInt(sampleSize, 10);
  const declaration: MethodDeclaration | null = paradigm
    ? {
        paradigm,
        ...(theory ? { theory } : {}),
        ...(sampling ? { sampling } : {}),
        ...(Number.isFinite(size) && size > 0 ? { sampleSize: size } : {}),
        ...(participants.trim() ? { participants: participants.trim() } : {}),
        ...(collection.trim() ? { collection: collection.trim() } : {}),
        ...(questionType ? { questionType } : {}),
        randomised,
        ...(strategy.trim() ? { identificationStrategy: strategy.trim() } : {}),
        apriorCodingFrame: apriori,
        claimsSaturation,
        ...(saturationAccount.trim() ? { saturationAccount: saturationAccount.trim() } : {}),
      }
    : null;

  const statement = useMemo(
    () => (declaration ? methodStatement(declaration) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(declaration)],
  );

  const chosen = paradigm ? PARADIGMS[paradigm] : null;
  const markdown = statement
    ? [statement.markdown, "", "### Still yours to write", ...statement.gaps.map((gap) => `- ${gap}`)].join("\n")
    : "";

  return (
    <div className="space-y-4">
      <section aria-labelledby="paradigm" className="rounded-lg border border-rule bg-raised p-5">
        <h3 id="paradigm" className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
          Paradigm
        </h3>
        <p className="mb-3 text-sm text-muted">
          What you take knowledge to be. It decides what counts as evidence, what a sample is for,
          and whether generalising is a virtue or a category error.
        </p>
        <label htmlFor="paradigm-select" className="sr-only">Choose a paradigm</label>
        <select
          id="paradigm-select"
          value={paradigm}
          onChange={(event) => setParadigm(event.target.value as ParadigmId)}
          className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
        >
          <option value="">Choose…</option>
          {PARADIGM_IDS.map((id) => (
            <option key={id} value={id}>{PARADIGMS[id].name}</option>
          ))}
        </select>

        {chosen && (
          <div className="mt-4 space-y-2 text-sm">
            {/* The gloss is what a first-year reads; the tradition is what a
                supervisor checks. Both, because they are different readers of
                the same screen. */}
            <p className="leading-relaxed">{chosen.gloss}</p>
            <p className="text-muted">{chosen.tradition}</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 pt-2 text-xs sm:grid-cols-4">
              <Fact label="Reality is" value={chosen.ontology} />
              <Fact label="Knowledge is" value={chosen.epistemology} />
              <Fact label="Design" value={chosen.design} />
              <Fact label="Sampling" value={chosen.sampling} />
            </dl>
            <p className="pt-1 text-xs text-muted">
              Coherent methods: {chosen.methods.join(", ")}.
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="theory" className="rounded-lg border border-rule bg-raised p-5">
        <h3 id="theory" className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
          Analytic approach
        </h3>
        <p className="mb-3 text-sm text-muted">
          What you look for in the data. Separate from the paradigm — that says what counts as
          knowledge, this says what you go and find.
        </p>
        <label htmlFor="theory-select" className="sr-only">Choose an analytic approach</label>
        <select
          id="theory-select"
          value={theory}
          onChange={(event) => setTheory(event.target.value as TheoryId)}
          className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
        >
          <option value="">None yet</option>
          {THEORY_IDS.map((id) => (
            <option key={id} value={id}>{THEORIES[id].name}</option>
          ))}
        </select>
        {theory && (
          <div className="mt-4 space-y-2 text-sm">
            <p className="leading-relaxed">{THEORIES[theory].gloss}</p>
            <p className="text-muted">{THEORIES[theory].tradition}</p>
            <p className="text-xs text-muted">
              Unit of analysis: {THEORIES[theory].unitOfAnalysis}.
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="design" className="rounded-lg border border-rule bg-raised p-5">
        <h3 id="design" className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Design
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="sampling" label="Sampling">
            <select
              id="sampling"
              value={sampling}
              onChange={(event) => setSampling(event.target.value as typeof sampling)}
              className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
            >
              <option value="">Not stated</option>
              <option value="purposive">Purposive — chosen for what they can show</option>
              <option value="statistical">Statistical — chosen to represent a population</option>
            </select>
          </Field>

          <Field id="question-type" label="The research question is">
            <select
              id="question-type"
              value={questionType}
              onChange={(event) => setQuestionType(event.target.value as typeof questionType)}
              className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
            >
              <option value="">Not stated</option>
              <option value="exploratory">Exploratory — what is going on here</option>
              <option value="descriptive">Descriptive — how much, how often</option>
              <option value="associational">Associational — do these go together</option>
              <option value="causal">Causal — does one produce the other</option>
            </select>
          </Field>

          <Field id="sample-size" label="Sample size">
            <input
              id="sample-size"
              value={sampleSize}
              inputMode="numeric"
              onChange={(event) => setSampleSize(event.target.value)}
              className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
            />
          </Field>

          <Field id="participants" label="Who they are">
            <input
              id="participants"
              value={participants}
              placeholder="journalists, patients, undergraduates"
              onChange={(event) => setParticipants(event.target.value)}
              className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
            />
          </Field>
        </div>

        <div className="mt-3">
          <Field id="collection" label="How the data are collected">
            <input
              id="collection"
              value={collection}
              placeholder="semi-structured interviews, a survey, a corpus of documents"
              onChange={(event) => setCollection(event.target.value)}
              className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
            />
          </Field>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          {questionType === "causal" && (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={randomised} onChange={(e) => setRandomised(e.target.checked)} />
                Participants were randomly allocated to conditions
              </label>
              {!randomised && (
                <Field id="strategy" label="What licenses the causal reading, if anything">
                  <input
                    id="strategy"
                    value={strategy}
                    placeholder="an instrument, a discontinuity, a defended counterfactual"
                    onChange={(event) => setStrategy(event.target.value)}
                    className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
                  />
                </Field>
              )}
            </>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={apriori} onChange={(e) => setApriori(e.target.checked)} />
            The coding frame is fixed before collection
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={claimsSaturation}
              onChange={(e) => setClaimsSaturation(e.target.checked)}
            />
            The write-up claims thematic saturation
          </label>
          {claimsSaturation && (
            <Field id="saturation" label="How saturation was judged">
              <input
                id="saturation"
                value={saturationAccount}
                placeholder="the last four interviews produced no new codes"
                onChange={(event) => setSaturationAccount(event.target.value)}
                className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
              />
            </Field>
          )}
        </div>
      </section>

      {statement && statement.tensions.length > 0 && (
        <section aria-labelledby="tensions" className="rounded-lg border border-accent/40 bg-raised p-5">
          <h3 id="tensions" className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">
            Worth settling
          </h3>
          {/* Nothing here blocks. Every one of these is defensible in some
              study — pragmatism exists partly to defend several — and a tool
              that refused a design would be overruling a supervisor it cannot
              hear. Said once, at the top, so the tone is not mistaken. */}
          <p className="mb-4 text-sm text-muted">
            None of these stops you. They are the questions a supervisor asks, with the reference
            that settles each one.
          </p>
          <ul className="space-y-4">
            {statement.tensions.map((tension, index) => (
              <li key={index} className="border-t border-rule pt-4 first:border-t-0 first:pt-0">
                <p className="text-sm leading-relaxed">
                  <span
                    className={cn(
                      "mr-2 rounded px-1.5 py-0.5 text-xs uppercase tracking-wider",
                      tension.level === "tension" ? "bg-accent/20 text-accent" : "bg-paper text-muted",
                    )}
                  >
                    {tension.level === "tension" ? "tension" : "note"}
                  </span>
                  {tension.says}
                </p>
                <p className="mt-1 text-sm text-muted">{tension.consider}</p>
                <p className="mt-1 text-xs text-muted">{tension.source}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {statement && (
        <section aria-labelledby="statement" className="rounded-lg border border-rule bg-raised p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 id="statement" className="text-xs font-semibold uppercase tracking-widest text-muted">
              Methodology statement
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(markdown).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-sm hover:bg-paper"
              >
                {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "methodology.md";
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-sm hover:bg-paper"
              >
                <Download aria-hidden className="h-4 w-4" />
                Download
              </button>
            </div>
          </div>
          <p className="mb-3 text-sm text-muted">
            The transcription, done. What is missing is listed at the end and is missing on purpose
            — the justification is your argument about your own study, and a fluent paragraph you
            did not write is worse than an obvious gap, because the gap gets filled.
          </p>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-paper p-4 font-mono text-xs leading-relaxed">
            {markdown}
          </pre>
        </section>
      )}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs uppercase tracking-wider text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value.replace(/_/g, " ")}</dd>
    </div>
  );
}
