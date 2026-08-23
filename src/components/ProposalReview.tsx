import { useState } from "react";
import { ExternalLink, FileUp, Loader2 } from "lucide-react";
import { readDocumentFile } from "@/lib/read-document.ts";
import { checkDois, searchReferences } from "@/lib/research-api.ts";
import { cn } from "@/lib/utils.ts";
import { PARADIGMS } from "@shared/research/method/paradigms.ts";
import { THEORIES } from "@shared/research/method/theories.ts";
import type { Reference } from "@shared/research/reference.ts";
import { leadingCaveat } from "@shared/research/reference.ts";
import type { Read } from "@shared/research/proposal/design.ts";
import type { Checker, DoiCheck, Supervision } from "@shared/research/proposal/supervise.ts";
import { superviseNotes, superviseProposal } from "@shared/research/proposal/supervise.ts";
import type { LiteratureRequest, LiteratureResult } from "@shared/research/search.ts";

/**
 * Why a check could not run, as a clause the report can put after "because".
 *
 * Written here rather than taken from the API's own message because that one
 * is a sentence for a toast. Dropped into `${n} could not be checked, because
 * X.` a capitalised sentence with its own full stop reads as a bug.
 */
function becauseOf(code: string): string {
  if (code === "unconfigured") return "this build is not connected to the checking service";
  if (code === "offline") return "the checking service could not be reached";
  if (code === "rate_limited" || code === "daily_ceiling") {
    return "the checking service has been asked as many times as it allows for now";
  }
  return "the check returned an error";
}

const check: Checker = async (dois) => {
  const response = await checkDois(dois);
  if (response.status === "ok") return response.checks;
  // Not a throw. Every identifier comes back unchecked with the reason, which
  // is the state the report already knows how to say out loud — and which
  // is emphatically not the same as saying they do not exist.
  return dois.map((doi): DoiCheck => ({ doi, kind: "unchecked", because: becauseOf(response.code) }));
};

const search = async (request: LiteratureRequest): Promise<LiteratureResult> => {
  const response = await searchReferences(request.text);
  if (response.status === "error") throw new Error(response.message);
  return {
    references: response.references,
    reportedTotal: response.reportedTotal,
    notes: response.notes,
  };
};

function Reading<T>({ label, read, name }: { label: string; read: Read<T> | null; name: (value: T) => string }) {
  return (
    <div className="border-t border-rule py-2 first:border-t-0">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      {read === null ? (
        <dd className="mt-0.5 text-sm text-muted">Not stated</dd>
      ) : (
        <>
          <dd className="mt-0.5 text-sm">
            {name(read.value)}
            {read.how === "mentioned" && (
              <span className="ml-2 rounded bg-paper px-1.5 py-0.5 text-xs text-muted">
                mentioned, not declared
              </span>
            )}
          </dd>
          <dd className="mt-1 text-xs italic text-muted">{read.evidence}</dd>
        </>
      )}
    </div>
  );
}

function Suggestion({
  reference,
  because,
  kept,
  onKeep,
}: {
  reference: Reference;
  because: string;
  kept: boolean;
  onKeep?: (reference: Reference) => void;
}) {
  const authors = reference.authors.map((author) => author.name);
  const line = authors.length === 0
    ? "No authors listed"
    : authors.length <= 3
      ? authors.join(", ")
      : `${authors.slice(0, 3).join(", ")} and ${authors.length - 3} others`;
  const caveat = leadingCaveat(reference);

  return (
    <li className="rounded-lg border border-rule bg-raised p-3">
      <p className="text-sm font-medium">{reference.title}</p>
      <p className="mt-0.5 text-xs text-muted">
        {line}
        {reference.year !== undefined && ` (${reference.year})`}
        {reference.venue !== undefined && ` — ${reference.venue}`}
      </p>
      <p className="mt-1.5 text-xs text-muted">{because}</p>
      <div className="mt-2 flex items-center gap-3">
        {reference.landingPageUrl !== undefined && (
          <a
            href={reference.landingPageUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            Open <ExternalLink aria-hidden className="h-3 w-3" />
          </a>
        )}
        {onKeep !== undefined && (
          <button
            type="button"
            disabled={kept}
            onClick={() => onKeep(reference)}
            className="rounded border border-rule px-2 py-1 text-xs hover:border-accent disabled:opacity-40"
          >
            {kept ? "In your reading list" : "Keep for this study"}
          </button>
        )}
      </div>
      {caveat !== null && (
        <p
          className={cn(
            "mt-2 rounded px-2 py-1 text-xs",
            reference.retraction === "confirmed"
              ? "bg-red-500/10 font-medium text-red-700 dark:text-red-400"
              : "bg-paper text-muted",
          )}
        >
          {caveat}
        </p>
      )}
    </li>
  );
}

/**
 * Hand over a proposal. Get back what a supervisor finds on a first reading.
 *
 * This stage exists for somebody who does not yet know the product has a
 * codebook screen, a coherence checker and a literature pipeline in it. They
 * have a proposal and a supervisor they see once a month, and the fastest
 * honest thing this software can do for them is the reading that is
 * arithmetic: what the design declares, whether the declarations agree, which
 * references are cited and not listed, and which identifiers resolve.
 *
 * **It does not rewrite anything, and the screen says so.** Suggesting a
 * better sentence is a judgement about argument; a deterministic version of
 * it would hand back prose nobody can defend, over the student's name, to an
 * examiner. Leaving the gap unexplained is worse than the gap: a student who
 * finds a report silent on their writing reads that as approval.
 */
export function ProposalReview({
  onKeep,
  kept,
}: {
  onKeep?: (reference: Reference) => void;
  kept?: ReadonlySet<string>;
}) {
  const [supervision, setSupervision] = useState<Supervision | null>(null);
  const [says, setSays] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [over, setOver] = useState(false);
  const [pasted, setPasted] = useState("");

  async function run(text: string) {
    setWorking(true);
    setSupervision(null);
    try {
      setSupervision(await superviseProposal(text, { check, search }));
    } catch (error) {
      setSays(`The reading did not finish: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setWorking(false);
    }
  }

  async function take(files: FileList | null) {
    if (!files || files.length === 0) return;
    setWorking(true);
    setSays(null);
    setSupervision(null);
    let result;
    try {
      result = await readDocumentFile(files[0]!);
    } catch (error) {
      // Reported, not swallowed, and the spinner comes down either way. A
      // reader that throws and a reader that hangs look identical from here,
      // and both used to leave "Reading it" on screen for good.
      setSays(`That file could not be read: ${error instanceof Error ? error.message : String(error)}`);
      setWorking(false);
      return;
    }
    if (result.text.trim() === "") {
      setSays(result.says);
      setWorking(false);
      return;
    }
    await run(result.text);
  }

  const notes = supervision === null ? [] : superviseNotes(supervision);
  const suggestions = supervision?.related.kind === "searched" ? supervision.related.suggestions : [];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-rule bg-raised p-4">
        <h3 className="text-sm font-medium">Hand over your proposal</h3>
        <p className="mt-1 text-sm text-muted">
          A PDF, a Word document or plain text. It is read in your browser and the text is not
          stored. What comes back is the reading that can be done by arithmetic: what your design
          declares, whether those declarations agree, which references are cited and not listed,
          and which identifiers resolve.
        </p>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            void take(event.dataTransfer.files);
          }}
          className={cn(
            "mt-3 rounded-lg border border-dashed p-6 text-center transition-colors",
            over ? "border-accent bg-accent/5" : "border-rule",
          )}
        >
          <FileUp className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
          <p className="mt-2 text-sm text-muted">Drop it here, or</p>
          <label className="mt-2 inline-block cursor-pointer rounded-lg border border-rule px-4 py-2 text-sm hover:border-accent">
            Choose a file
            <input
              type="file"
              className="sr-only"
              onChange={(event) => {
                void take(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted">Or paste the text</summary>
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            rows={6}
            aria-label="Proposal text"
            className="mt-2 w-full rounded-lg border border-rule bg-paper p-2 text-sm"
            placeholder="Paste the proposal, reference list and all."
          />
          <button
            type="button"
            disabled={pasted.trim().length < 200 || working}
            onClick={() => void run(pasted)}
            className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            Read it
          </button>
        </details>

        {working && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            Reading it, and checking the identifiers.
          </p>
        )}
        {says !== null && <p className="mt-3 text-sm text-muted">{says}</p>}
      </section>

      {supervision !== null && (
        <>
          <section className="rounded-lg border border-rule bg-raised p-4">
            <h3 className="text-sm font-medium">What it read</h3>
            <p className="mt-1 text-xs text-muted">
              Read from phrases in your text, not from meaning. Where it says something was
              mentioned rather than declared, it found the words but not in a sentence about your
              study — and did not use it.
            </p>
            <dl className="mt-3">
              <Reading
                label="Paradigm"
                read={supervision.design.paradigm}
                name={(value) => PARADIGMS[value].name}
              />
              <Reading
                label="Analytic theory"
                read={supervision.design.theory}
                name={(value) => THEORIES[value].name}
              />
              <Reading
                label="Sampling"
                read={supervision.design.sampling}
                name={(value) => (value === "purposive" ? "Purposive" : "Statistical")}
              />
              <Reading
                label="Sample size"
                read={supervision.design.sampleSize}
                name={(value) => String(value)}
              />
              <Reading
                label="Question type"
                read={supervision.design.questionType}
                name={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
              />
            </dl>
          </section>

          <section className="rounded-lg border border-rule bg-raised p-4">
            <h3 className="text-sm font-medium">What a first reading finds</h3>
            <ol className="mt-3 space-y-3">
              {notes.map((note) => (
                <li key={note} className="text-sm leading-relaxed">
                  {note}
                </li>
              ))}
            </ol>
          </section>

          {suggestions.length > 0 && (
            <section className="rounded-lg border border-rule bg-raised p-4">
              <h3 className="text-sm font-medium">Work you do not cite</h3>
              <p className="mt-1 text-xs text-muted">
                Found by matching words from your proposal against titles and abstracts. That
                finds what a search missed. It does not read, and it cannot tell you whether any
                of these belongs in your study.
              </p>
              <ul className="mt-3 space-y-2">
                {suggestions.map((suggestion) => (
                  <Suggestion
                    key={suggestion.reference.id}
                    reference={suggestion.reference}
                    because={suggestion.because}
                    kept={kept?.has(suggestion.reference.id) ?? false}
                    {...(onKeep === undefined ? {} : { onKeep })}
                  />
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-lg border border-rule bg-paper p-4">
            <h3 className="text-sm font-medium">What this does not do</h3>
            <p className="mt-1 text-sm text-muted">
              It does not rewrite your sentences, and it does not tell you whether an argument
              works. Both are judgements about writing, and nothing here is capable of one. A
              report that stayed silent about that would be letting you read its silence as
              approval.
            </p>
            <p className="mt-2 text-sm text-muted">
              It also cannot tell a reference spelled two ways from a reference that is missing.
              Every match above is by surname and year.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
