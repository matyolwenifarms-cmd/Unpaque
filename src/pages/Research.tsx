import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { AnalyseData } from "@/components/AnalyseData.tsx";
import { ChooseMethod } from "@/components/ChooseMethod.tsx";
import { CodeText } from "@/components/CodeText.tsx";
import { DataReview } from "@/components/DataReview.tsx";
import { DataUpload } from "@/components/DataUpload.tsx";
import { DatasetSummary } from "@/components/DatasetSummary.tsx";
import { Papers } from "@/components/Papers.tsx";
import { ProposalReview } from "@/components/ProposalReview.tsx";
import { Screening } from "@/components/Screening.tsx";
import { ReferenceList } from "@/components/ReferenceList.tsx";
import { StudyBar } from "@/components/StudyBar.tsx";
import { useStudies } from "@/hooks/useStudies.ts";
import {
  clearFindings,
  keepReference,
  loadFindings,
  loadMethodDeclaration,
  loadReferences,
  saveFinding,
  saveMethodDeclaration,
} from "@/lib/qualitative-api.ts";

/**
 * Replace a study's stored analyses with the list on screen.
 *
 * Cleared and re-inserted rather than diffed. There are a handful of analyses
 * in a study, `study_findings` has no update policy on purpose — a finding is
 * re-run, not edited — and a diff would need a stable identity for a value
 * object that has none. Whole-list replacement is the only version that cannot
 * end up half-applied.
 */
async function storeFindings(
  studyId: string,
  findings: readonly Finding[],
  descriptives: Array<{ label: string; stats: Descriptives }>,
  datasetName: string | null,
): Promise<void> {
  await clearFindings(studyId);
  for (const [index, finding] of findings.entries()) {
    await saveFinding(studyId, finding, descriptives, datasetName, index + 1);
  }
}
import { WriteUp } from "@/components/WriteUp.tsx";
import { cn } from "@/lib/utils.ts";
import type { Dataset } from "@shared/research/analytics/dataset.ts";
import { resultsSection } from "@shared/research/analytics/apa.ts";
import type { Descriptives } from "@shared/research/analytics/describe.ts";
import type { Finding } from "@shared/research/analytics/result.ts";
import type { MethodStatement } from "@shared/research/method/statement.ts";
import type { Reference } from "@shared/research/reference.ts";
import type { Supplied } from "@shared/research/writeup/document.ts";
import { referenceList } from "@shared/research/writeup/references.ts";
import { searchReferences, type ResultOrder, type SearchedReference } from "@/lib/research-api.ts";

/**
 * The stages that exist.
 *
 * Named for what the researcher is doing, not for what the software is doing.
 * The specification's lifecycle has four — proposal, collection, analysis,
 * write-up — and write-up is not built; putting it here inert would be a menu
 * that lies about the product.
 *
 * Analysis is two entries rather than one because the two are different work
 * with different evidence. A researcher with transcripts is not choosing a
 * t-test, and a menu that sends them to a column picker teaches them the tool
 * is not for them.
 *
 * Proposal is first, and is the only stage that needs nothing chosen first.
 * Everything after it asks the researcher to already know which part of their
 * work the software is for; that one takes the document they have and tells
 * them. Somebody who has never seen this product should be able to start
 * there and find out what the rest of it is for.
 */
const STAGES = [
  { id: "proposal", name: "Proposal", blurb: "Check its references and its design" },
  { id: "literature", name: "Literature", blurb: "Find and verify references" },
  { id: "papers", name: "Papers", blurb: "Hold the papers, and set them against each other" },
  { id: "screening", name: "Screening", blurb: "Decide what is in the review, and count the flow" },
  { id: "method", name: "Method", blurb: "Declare the paradigm and approach" },
  { id: "analyse", name: "Analyse data", blurb: "Upload a file and run a test" },
  { id: "code", name: "Code text", blurb: "Code transcripts and build themes" },
  { id: "writeup", name: "Write up", blurb: "Assemble what is written, and what is not" },
] as const;
type Stage = (typeof STAGES)[number]["id"];

function ResearchHeader({ stage, onStage }: { stage: Stage; onStage: (stage: Stage) => void }) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight">Research</h1>
      <nav aria-label="Stage" className="mt-3 flex flex-wrap gap-2">
        {STAGES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={stage === option.id}
            onClick={() => onStage(option.id)}
            className={cn(
              "rounded-lg border px-4 py-2 text-left transition-colors",
              stage === option.id
                ? "border-accent bg-accent/10"
                : "border-rule bg-raised hover:border-muted",
            )}
          >
            <span className="block text-sm font-medium">{option.name}</span>
            <span className="block text-xs text-muted">{option.blurb}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}

/**
 * What to do next, in the researcher's own words.
 *
 * The box is for instructions — "write this up as a results section", "compare
 * these against the second cohort" — and it is not connected to anything that
 * can carry them out. It is here rather than absent because a researcher
 * finishing an analysis has a next instruction in mind and needs somewhere to
 * put it; it says plainly that nothing acts on it yet, because a box that
 * silently swallows an instruction is worse than no box.
 *
 * Report writing needs a model. When one is configured this becomes the way in;
 * until then the honest state is this one. **Do not soften this copy while the
 * button still does nothing.**
 */
function Instructions({ hasData }: { hasData: boolean }) {
  const [text, setText] = useState("");
  return (
    <section aria-labelledby="instructions" className="rounded-lg border border-rule bg-raised p-5">
      <h3 id="instructions" className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
        What next
      </h3>
      <p className="mb-3 text-sm text-muted">
        {hasData
          ? "Anything else you want done with this — writing it up, another comparison, a different framing."
          : "Load a file first, then say what you want done with it."}
      </p>
      <textarea
        aria-label="Further instructions"
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Write this up as a results section in APA style…"
        className="w-full resize-y rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
      />
      <p className="mt-2 text-sm leading-relaxed text-accent">
        Nothing acts on this yet, and what you type here is not sent anywhere. The results section
        above is already written from your analyses and needs no model — what is missing is the
        discussion, and that needs one.
      </p>
    </section>
  );
}

export default function Research() {
  const [query, setQuery] = useState("");
  const [fromYear, setFromYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [references, setReferences] = useState<SearchedReference[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<ResultOrder>("relevance");
  // What the list on screen was actually ordered by, which is not `order` once
  // somebody has changed the control without searching again. Labelling a list
  // "most relevant first" while it is still sorted by date is the same lie as
  // before, told by a control instead of a sort.
  const [shownOrder, setShownOrder] = useState<ResultOrder>("relevance");
  // Proposal, not literature. The first screen a researcher sees should be
  // the one that asks nothing of them: a literature search asks for a query,
  // and somebody who does not yet know what this product does has no way to
  // know a good one. They have a document; this reads it.
  const [stage, setStage] = useState<Stage>("proposal");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  // What the other stages have produced. Held here because the write-up
  // transcribes all four and each is owned by a different stage; a stage that
  // has not been visited simply reports nothing, and the write-up says so.
  const [method, setMethod] = useState<MethodStatement | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [described, setDescribed] = useState<Array<{ label: string; stats: Descriptives }>>([]);
  const [qualitative, setQualitative] = useState<{ markdown: string; from: string } | null>(null);
  /** The declaration as it was stored, handed back to the Method form. */
  const [declaration, setDeclaration] = useState<unknown>(null);
  /** References kept for this study, which is not the search result list. */
  const [kept, setKept] = useState<Reference[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dropped, setDropped] = useState(0);
  const studies = useStudies();
  const studyId = studies.studyId;

  // Loaded when a study is opened, and cleared when one is closed. Cleared
  // rather than left standing: showing the previous study's analyses under a
  // new study's name is the failure this whole lift was meant to prevent.
  useEffect(() => {
    if (studyId === null) {
      setMethod(null);
      setFindings([]);
      setDescribed([]);
      setKept([]);
      setDropped(0);
      return;
    }
    let active = true;
    void loadMethodDeclaration(studyId).then((result) => {
      if (!active || !result.ok) return;
      setDeclaration(result.data ?? null);
    });
    void loadFindings(studyId).then((result) => {
      if (!active || !result.ok) return;
      setFindings(result.data.findings);
      setDescribed(result.data.descriptives);
      setFileName(result.data.datasetName);
      setDropped((was) => was + result.data.dropped);
    });
    void loadReferences(studyId).then((result) => {
      if (!active || !result.ok) return;
      setKept(result.data.references);
      setDropped((was) => was + result.data.dropped);
    });
    return () => {
      active = false;
    };
  }, [studyId]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || query.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setReferences(null);
    setNotes([]);

    const year = /^\d{4}$/.test(fromYear) ? Number(fromYear) : undefined;
    const result = await searchReferences(query.trim(), year, order);
    if (result.status === "ok") {
      setReferences(result.references);
      setNotes(result.notes);
      setTotal(result.reportedTotal);
      setShownOrder(order);
    } else {
      setError(result.message);
    }
    setBusy(false);
  }

  // One wrapper, so the header and the study bar are rendered in one place.
  // Five copies of them was five places to forget one.
  const frame = (body: React.ReactNode) => (
    <div>
      <ResearchHeader stage={stage} onStage={setStage} />
      <StudyBar studies={studies} />
      {dropped > 0 && (
        <p className="mb-4 rounded-lg border border-rule bg-raised p-3 text-sm text-muted">
          {dropped} stored {dropped === 1 ? "record" : "records"} could not be read back and{" "}
          {dropped === 1 ? "was" : "were"} left out. Nothing was guessed at: a half-read analysis or
          reference is not shown at all.
        </p>
      )}
      {body}
    </div>
  );

  if (stage === "proposal") {
    return frame(
      <ProposalReview
        kept={new Set(kept.map((reference) => reference.id))}
        {...(studyId === null
          ? {}
          : {
              onKeep: (reference: Reference) => {
                setKept((was) => [...was, reference]);
                void keepReference(studyId, reference);
              },
            })}
      />,
    );
  }

  if (stage === "papers") {
    return frame(<Papers studyId={studyId} />);
  }

  if (stage === "screening") {
    return frame(<Screening studyId={studyId} />);
  }

  if (stage === "method") {
    return frame(
      <ChooseMethod
        // Keyed on the study so that opening a different one remounts the
        // form. Without it React keeps the previous study's thirteen fields
        // and the researcher edits one study's methodology into another's.
        key={studyId ?? "unsaved"}
        initial={declaration}
        onStatement={setMethod}
        onDeclaration={(next) => {
          if (studyId !== null) void saveMethodDeclaration(studyId, next);
        }}
      />,
    );
  }

  if (stage === "writeup") {
    const shownReferences: Reference[] = studyId !== null ? kept : (references ?? []);
    // Assembled at render rather than kept in state: every input is already
    // state, and a fifth copy would be a fifth thing to keep in step.
    const supplied: Supplied = {
      ...(method ? { method: { markdown: method.markdown, gaps: method.gaps } } : {}),
      ...(findings.length > 0
        ? {
            results: {
              markdown: resultsSection({
                findings: [...findings].reverse(),
                descriptives: described,
                ...(dataset ? { rowsInFile: dataset.rows } : {}),
              }),
              from: `${findings.length} ${findings.length === 1 ? "analysis" : "analyses"}${fileName ? ` on ${fileName}` : ""}`,
            },
          }
        : {}),
      ...(qualitative ? { findings: qualitative } : {}),
      // The study's reading list when there is one, and the search results
      // otherwise. Not both: a bibliography assembled from whatever happened
      // to be on screen is one that changes when somebody searches again.
      ...(shownReferences.length > 0
        ? { references: { markdown: referenceList(shownReferences), count: shownReferences.length } }
        : {}),
    };
    return frame(
      <WriteUp title={studies.study?.title ?? query.trim() ?? ""} supplied={supplied} />,
    );
  }

  if (stage === "code") {
    return frame(
      <CodeText
        studies={studies}
        onFindings={(markdown, from) =>
          setQualitative(markdown === "" ? null : { markdown, from })
        }
      />,
    );
  }

  if (stage === "analyse") {
    return frame(
      <div className="space-y-4">
          <DataUpload
            fileName={fileName}
            onLoaded={(loaded, name) => {
              setDataset(loaded);
              setFileName(name);
            }}
          />
          {dataset && <DatasetSummary dataset={dataset} />}
          {/* Between what was read and what to run: the sentences a
              supervisor would say about the file. `DatasetSummary` shows the
              same facts as a table, which only helps somebody who already
              knows which of them is a problem. */}
          {dataset && <DataReview dataset={dataset} />}
        {dataset && (
          <AnalyseData
            // Keyed on the study for the same reason the method form is.
            key={studyId ?? "unsaved"}
            dataset={dataset}
            initialFindings={findings}
            onFindings={(ran, stats) => {
              setFindings(ran);
              setDescribed(stats);
              if (studyId !== null) void storeFindings(studyId, ran, stats, fileName);
            }}
          />
        )}
        <Instructions hasData={dataset !== null} />
      </div>,
    );
  }

  return frame(
    <>
      {/* The heading lives in ResearchHeader, once. The old one was left here
          with sr-only, which still renders the element — so the page had two
          h1s reading "Research", and an outline with two top-level headings is
          one nobody can navigate. The browser smoke check found it. */}
      <p className="mb-6 text-sm text-muted">
        Every reference comes from a bibliographic provider and its identifier is re-checked before
        it is shown to you.
      </p>

      <form onSubmit={onSubmit} className="mb-6">
        <label htmlFor="query" className="sr-only">
          What are you looking for?
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* A textarea, not an input. The feature asks for a proposal or an
              abstract and a one-line box says it wants a phrase — and a long
              paste into a box that shows six words of it looks like it was
              truncated. Long input is reduced to its search terms server-side
              and the notes above the results say which. */}
          <textarea
            id="query"
            rows={3}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A question, or paste an abstract or proposal"
            className="flex-1 resize-y rounded-lg border border-rule bg-raised px-4 py-3 outline-none focus:border-accent"
          />
          <label htmlFor="fromYear" className="sr-only">
            Published from year
          </label>
          <input
            id="fromYear"
            value={fromYear}
            onChange={(event) => setFromYear(event.target.value)}
            placeholder="from year"
            inputMode="numeric"
            className="w-full rounded-lg border border-rule bg-raised px-4 py-3 outline-none focus:border-accent sm:w-32"
          />
          <button
            type="submit"
            disabled={busy || query.trim().length < 3}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 font-medium text-accent-ink disabled:opacity-40"
          >
            {busy ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Search aria-hidden className="h-4 w-4" />
            )}
            {busy ? "Searching" : "Search"}
          </button>
        </div>

        {/* Relevance is the default and stays the default. Ordering the whole
            result set by date does not sort the literature, it replaces it:
            what surfaces is whatever carries the newest date, related to the
            question or not. It is offered because a researcher does sometimes
            want it — over a set relevance has already chosen. */}
        <fieldset className="mt-3 flex flex-wrap items-center gap-2">
          <legend className="sr-only">Order the results</legend>
          <span className="text-sm text-muted">Order by</span>
          {([["relevance", "Most relevant"], ["recency", "Newest first"]] as const).map(
            ([value, label]) => (
              <label
                key={value}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  order === value
                    ? "border-accent bg-accent/10 font-medium"
                    : "border-rule bg-raised hover:border-muted",
                )}
              >
                <input
                  type="radio"
                  name="order"
                  value={value}
                  checked={order === value}
                  onChange={() => setOrder(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ),
          )}
        </fieldset>
      </form>

      <div aria-live="polite">
        {error && (
          <div className="rounded-lg border border-rule bg-raised p-5">
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* The notes are rendered above the results, not below them. A search
            that returned less because a provider was down is indistinguishable
            from a smaller literature, and a reader who has to scroll past the
            list to learn that has already drawn their conclusion. */}
        {notes.length > 0 && (
          <div className="mb-4 rounded-lg border border-rule bg-raised p-4 text-sm">
            <p className="mb-2 font-medium">What this search did</p>
            <ul className="space-y-1 text-muted">
              {notes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {references && references.length > 0 && (
          <>
            {/* Says which ordering produced this list. Sorted by date, a
                reference list looks exactly like one ranked by relevance —
                same layout, same badges — and somebody who cannot tell which
                they are reading cannot tell a thin field from a bad sort. */}
            <p className="mb-3 text-sm text-muted">
              Showing {references.length} of about {total.toLocaleString("en-GB")},{" "}
              {shownOrder === "recency" ? "newest first" : "most relevant first"}.
            </p>
            <ReferenceList
              references={references}
              kept={new Set(kept.map((reference) => reference.id))}
              {...(studyId === null
                ? {}
                : {
                    onKeep: (reference) => {
                      // Optimistic, and safe to be: the unique index refuses a
                      // duplicate and the client treats that as success, so the
                      // worst case is a button that was already true.
                      setKept((was) => [...was, reference]);
                      void keepReference(studyId, reference);
                    },
                  })}
            />
          </>
        )}

        {references && references.length === 0 && !error && (
          <div className="rounded-lg border border-rule bg-raised p-5">
            <p className="leading-relaxed">
              Nothing came back for that. Read the notes above before concluding the literature is
              thin — a provider being unreachable looks exactly like this.
            </p>
          </div>
        )}
      </div>
    </>,
  );
}
