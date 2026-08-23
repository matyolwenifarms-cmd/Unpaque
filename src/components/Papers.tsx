import { useCallback, useEffect, useMemo, useState } from "react";
import { HelpCircle, Trash2 } from "lucide-react";
import { CorpusPortal } from "@/components/CorpusPortal.tsx";
import { PaperView, type Passage } from "@/components/PaperView.tsx";
import {
  addRelation,
  addSource,
  dropRelation,
  dropSource,
  loadPages,
  loadRelations,
  loadSources,
  type CorpusSource,
  type NewSource,
  type Relation,
} from "@/lib/corpus-api.ts";
import { STUDY_RELATIONS, basisProblem, readRelation, type StudyRelation }
  from "@shared/relations/corpus.ts";
import {
  suggestDisagreements,
  suggestionSummary,
  type CorpusPaper,
  type Suggestion,
} from "@shared/relations/suggest.ts";
import { cn } from "@/lib/utils.ts";

interface Draft {
  relation: StudyRelation;
  sourceId: string;
  targetId: string;
  basis: string;
}

/**
 * The papers a study holds, and what they say against each other.
 *
 * Three things on one screen, in the order a reviewer works: what is in the
 * corpus, where the figures disagree, and what has been recorded about it.
 *
 * The disagreements are questions rather than findings, and the wording is
 * load-bearing. Two papers reporting 40 and 52 for the same population may
 * both be right, because they counted different things; the software can see
 * that the numbers differ and cannot see which it is. So every one of them
 * arrives as something to answer, and the answer is a sentence the reviewer
 * writes.
 */
export function Papers({ studyId }: { studyId: string | null }) {
  const [sources, setSources] = useState<CorpusSource[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [papers, setPapers] = useState<CorpusPaper[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = useCallback(async (id: string) => {
    const [listed, related] = await Promise.all([loadSources(id), loadRelations(id)]);
    if (listed.ok) setSources(listed.data);
    if (related.ok) setRelations(related.data);
    if (!listed.ok) setProblem(listed.message);
  }, []);

  useEffect(() => {
    if (studyId === null) {
      setSources([]);
      setRelations([]);
      setPapers([]);
      return;
    }
    void refresh(studyId);
  }, [studyId, refresh]);

  // The pages, for the comparison. Loaded once per corpus rather than per
  // render: a study of forty papers is forty round trips, and doing them again
  // on every keystroke in the basis field would be absurd.
  useEffect(() => {
    let live = true;
    const withText = sources.filter((source) => source.pageCount > 0);
    if (withText.length === 0) {
      setPapers([]);
      return;
    }
    void Promise.all(withText.map(async (source) => {
      const pages = await loadPages(source.id);
      return { id: source.id, name: source.name, pages: pages.ok ? pages.data : [] };
    })).then((loaded) => {
      if (live) setPapers(loaded);
    });
    return () => {
      live = false;
    };
  }, [sources]);

  const suggestions = useMemo(() => suggestDisagreements(papers), [papers]);
  const nameOf = useCallback(
    (id: string) => sources.find((source) => source.id === id)?.name ?? "a paper no longer held",
    [sources],
  );

  /** Pairs a reviewer has already answered, in either direction. */
  const answered = useMemo(() => {
    const set = new Set<string>();
    for (const relation of relations) {
      set.add(`${relation.sourceId}~${relation.targetId}`);
      set.add(`${relation.targetId}~${relation.sourceId}`);
    }
    return set;
  }, [relations]);

  async function importSources(incoming: NewSource[]) {
    if (studyId === null) return;
    setWorking(true);
    setProblem(null);
    try {
      for (const source of incoming) {
        const result = await addSource(studyId, source);
        if (!result.ok) {
          setProblem(result.message);
          break;
        }
      }
      await refresh(studyId);
    } finally {
      setWorking(false);
    }
  }

  async function record() {
    if (studyId === null || draft === null) return;
    // No basis check here. It would be unreachable: the button is disabled
    // while `basisProblem` returns anything, and a check no input can trip is
    // not a safeguard, it is a line that reads like one. What actually refuses
    // a bad basis however this row is written is the check constraint on
    // `study_relations`, which `research_corpus_test.sql` holds down.
    setWorking(true);
    const result = await addRelation(studyId, draft);
    setWorking(false);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    setDraft(null);
    setProblem(null);
    await refresh(studyId);
  }

  if (studyId === null) {
    return (
      <div className="rounded-lg border border-rule bg-raised p-5">
        <p className="text-sm">
          Open a study above to hold papers in it. Papers belong to a study, so that a corpus
          gathered for one question is not silently reused for another.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CorpusPortal onImport={(incoming) => void importSources(incoming)} working={working} />

      {problem !== null && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {problem}
        </p>
      )}

      <section aria-labelledby="held" className="rounded-lg border border-rule bg-raised p-4">
        <h3 id="held" className="text-sm font-medium">
          {sources.length === 0
            ? "No papers yet"
            : `${sources.length} ${sources.length === 1 ? "paper" : "papers"} in this study`}
        </h3>
        {sources.length === 0 ? (
          <p className="mt-1 text-sm text-muted">
            Nothing has been added. Everything below works over the papers a study holds.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {sources.map((source) => (
              <li key={source.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(open === source.id ? null : source.id)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-left text-sm",
                    open === source.id ? "border-accent" : "border-rule hover:border-accent",
                  )}
                >
                  {source.name}
                  <span className="ml-2 text-xs text-muted">
                    {source.pageCount === 0
                      ? "no text layer"
                      : `${source.pageCount} page${source.pageCount === 1 ? "" : "s"}`}
                    {source.doi !== null && ` · ${source.doi}`}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${source.name}`}
                  onClick={async () => {
                    await dropSource(source.id);
                    if (open === source.id) setOpen(null);
                    await refresh(studyId);
                  }}
                  className="rounded-md border border-rule p-2 text-muted hover:border-accent"
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {open !== null && (
        <>
          <PaperView
            sourceId={open}
            name={nameOf(open)}
            pageCount={sources.find((source) => source.id === open)?.pageCount ?? 0}
            onSelect={setPassage}
          />
          {passage !== null && (
            <p className="text-sm text-muted">
              Page {passage.page}, characters {passage.start} to {passage.end}: “{passage.text}”
            </p>
          )}
        </>
      )}

      <section aria-labelledby="questions" className="rounded-lg border border-rule bg-raised p-4">
        <h3 id="questions" className="text-sm font-medium">Figures that disagree</h3>
        <p className="mt-1 text-sm">{suggestionSummary(suggestions, papers.length)}</p>

        {suggestions.length > 0 && (
          <ul className="mt-3 space-y-2">
            {suggestions.map((suggestion) => (
              <Question
                key={`${suggestion.a.id}:${suggestion.a.figure}:${suggestion.b.id}:${suggestion.b.figure}`}
                suggestion={suggestion}
                alreadyAnswered={answered.has(`${suggestion.a.id}~${suggestion.b.id}`)}
                onAnswer={(relation) =>
                  setDraft({
                    relation,
                    sourceId: suggestion.a.id,
                    targetId: suggestion.b.id,
                    basis: `${suggestion.a.name} gives ${suggestion.a.figure} on page ${suggestion.a.page}; ${suggestion.b.name} gives ${suggestion.b.figure} on page ${suggestion.b.page}. `,
                  })}
              />
            ))}
          </ul>
        )}
      </section>

      {draft !== null && (
        <section aria-labelledby="record" className="rounded-lg border border-accent bg-raised p-4">
          <h3 id="record" className="text-sm font-medium">
            {readRelation(draft.relation, nameOf(draft.sourceId), nameOf(draft.targetId))}
          </h3>
          <p className="mt-1 text-xs text-muted">
            The direction is part of the claim. This says the first does the{" "}
            {draft.relation === "contradicts" ? "contradicting" : "corroborating"}, not the second.
          </p>

          <label className="mt-3 block text-sm">
            Why
            <textarea
              value={draft.basis}
              rows={3}
              onChange={(event) =>
                setDraft((was) => (was === null ? was : { ...was, basis: event.target.value }))}
              className="mt-1 w-full rounded-md border border-rule bg-paper p-2 text-sm"
            />
          </label>
          <p className="mt-1 text-xs text-muted">
            {basisProblem(draft.basis) ??
              "This is what an examiner reads when they ask why these two are connected."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {STUDY_RELATIONS.map((relation) => (
              <button
                key={relation}
                type="button"
                onClick={() =>
                  setDraft((was) => (was === null ? was : { ...was, relation }))}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm",
                  draft.relation === relation ? "border-accent" : "border-rule hover:border-accent",
                )}
              >
                {relation}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void record()}
              disabled={working || basisProblem(draft.basis) !== null}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
            >
              Record it
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setProblem(null);
              }}
              className="rounded-lg border border-rule px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {relations.length > 0 && (
        <section aria-labelledby="recorded" className="rounded-lg border border-rule bg-raised p-4">
          <h3 id="recorded" className="text-sm font-medium">
            {relations.length} recorded
          </h3>
          <ul className="mt-3 space-y-2">
            {relations.map((relation) => (
              <li key={relation.id} className="rounded-md border border-rule bg-paper p-3">
                <p className="text-sm font-medium">
                  {readRelation(relation.relation, nameOf(relation.sourceId), nameOf(relation.targetId))}
                </p>
                <p className="mt-1 text-sm text-muted">{relation.basis}</p>
                <button
                  type="button"
                  onClick={async () => {
                    await dropRelation(relation.id);
                    await refresh(studyId);
                  }}
                  className="mt-2 text-xs text-muted underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Question({
  suggestion,
  alreadyAnswered,
  onAnswer,
}: {
  suggestion: Suggestion;
  alreadyAnswered: boolean;
  onAnswer: (relation: StudyRelation) => void;
}) {
  return (
    <li className="rounded-lg border border-rule bg-paper p-3">
      <p className="flex items-start gap-1.5 text-sm">
        <HelpCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <span>
          <strong>{suggestion.a.name}</strong> gives {suggestion.a.figure} on page{" "}
          {suggestion.a.page}; <strong>{suggestion.b.name}</strong> gives {suggestion.b.figure} on
          page {suggestion.b.page}. Both sit in the words “{suggestion.context}”.
        </span>
      </p>
      {alreadyAnswered ? (
        <p className="mt-2 text-xs text-muted">
          You have already recorded something between these two.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAnswer("contradicts")}
            className="rounded-md border border-rule px-3 py-1 text-xs hover:border-accent"
          >
            Record a contradiction
          </button>
          <button
            type="button"
            onClick={() => onAnswer("corroborates")}
            className="rounded-md border border-rule px-3 py-1 text-xs hover:border-accent"
          >
            Record a corroboration
          </button>
        </div>
      )}
    </li>
  );
}
