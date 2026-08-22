import { useEffect, useMemo, useState } from "react";
import { coOccurrence } from "@shared/research/qualitative/coding.ts";
import { readSaturation } from "@shared/research/qualitative/saturation.ts";
import { CodeDocument } from "@/components/CodeDocument.tsx";
import { Codebook } from "@/components/Codebook.tsx";
import { ThemeBoard } from "@/components/ThemeBoard.tsx";
import { useQualitativeStudy } from "@/hooks/useQualitativeStudy.ts";
import { useSession } from "@/hooks/useSession.ts";
import { createStudy, listStudies, type StudySummary } from "@/lib/qualitative-api.ts";
import { cn } from "@/lib/utils.ts";

const VIEWS = [
  { id: "code", name: "Code", blurb: "Read a transcript and apply codes" },
  { id: "themes", name: "Themes", blurb: "Assemble themes from the codes" },
  { id: "saturation", name: "Saturation", blurb: "What the coding record shows" },
] as const;
type View = (typeof VIEWS)[number]["id"];

/**
 * Qualitative analysis: transcripts, a codebook, themes, and the saturation
 * account a methodology chapter needs.
 *
 * Signed in, everything is kept in Postgres. Signed out it still works and
 * holds nothing, and says so — because a researcher deciding whether the
 * coding surface suits them should not have to make an account to find out,
 * and because a screen that quietly discards days of work is the worst thing
 * this feature could do.
 */
export function CodeText() {
  const { session, configured } = useSession();
  const [studies, setStudies] = useState<StudySummary[] | null>(null);
  const [studyId, setStudyId] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [listProblem, setListProblem] = useState<string | null>(null);

  const store = useQualitativeStudy(studyId);

  useEffect(() => {
    if (!configured || !session) {
      setStudies(null);
      setStudyId(null);
      return;
    }
    let active = true;
    void listStudies().then((result) => {
      if (!active) return;
      if (!result.ok) return setListProblem(result.message);
      setListProblem(null);
      setStudies(result.data);
      // Opened rather than offered when there is exactly one. A picker with a
      // single entry is a click that teaches nothing.
      if (result.data.length === 1) setStudyId(result.data[0]!.id);
    });
    return () => {
      active = false;
    };
  }, [configured, session]);

  async function startStudy(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim() === "") return;
    const result = await createStudy(title, question);
    if (!result.ok) return setListProblem(result.message);
    setListProblem(null);
    setStudies((was) => [result.data, ...(was ?? [])]);
    setStudyId(result.data.id);
    setTitle("");
    setQuestion("");
    setNaming(false);
  }

  return (
    <div className="space-y-4">
      {session && studies !== null && (
        <StudyPicker
          studies={studies}
          studyId={studyId}
          onOpen={setStudyId}
          naming={naming}
          onNaming={setNaming}
          title={title}
          onTitle={setTitle}
          question={question}
          onQuestion={setQuestion}
          onStart={startStudy}
        />
      )}

      {listProblem && (
        <p className="rounded-lg border border-rule bg-raised p-3 text-sm" role="alert">
          {listProblem}
        </p>
      )}

      {/* The notice tracks the behaviour rather than the feature existing.
          Copy changes with behaviour, in the same commit — a warning somebody
          finds decorative teaches them to discount the next one. */}
      {!store.kept && (
        <p className="rounded-lg border border-rule bg-raised p-3 text-sm text-muted">
          {session
            ? "Nothing here is saved until you open or start a study. Transcripts, codes and themes live in this browser tab only."
            : configured
              ? "Nothing here is saved. Transcripts, codes and themes live in this browser tab, and closing or refreshing it loses them — sign in and start a study to keep your coding."
              : "This build is not connected to an Unpaque project, so nothing here is saved. Transcripts, codes and themes live in this browser tab only."}
        </p>
      )}

      {store.problem && (
        <p className="rounded-lg border border-rule bg-raised p-3 text-sm" role="alert">
          {store.problem}
        </p>
      )}

      {store.loading ? <p className="text-sm text-muted">Opening the study…</p> : <Workspace store={store} />}
    </div>
  );
}

function StudyPicker({
  studies,
  studyId,
  onOpen,
  naming,
  onNaming,
  title,
  onTitle,
  question,
  onQuestion,
  onStart,
}: {
  studies: readonly StudySummary[];
  studyId: string | null;
  onOpen: (id: string) => void;
  naming: boolean;
  onNaming: (naming: boolean) => void;
  title: string;
  onTitle: (title: string) => void;
  question: string;
  onQuestion: (question: string) => void;
  onStart: (event: React.FormEvent) => void;
}) {
  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-medium">Your studies</h3>
        <button
          type="button"
          onClick={() => onNaming(!naming)}
          className="rounded-lg border border-rule px-3 py-1.5 text-xs hover:border-accent"
        >
          {naming ? "Close" : "New study"}
        </button>
      </div>

      {studies.length === 0 && !naming && (
        <p className="text-sm text-muted">
          A study holds its transcripts, its codebook and everything coded in it. Start one and the
          work is kept.
        </p>
      )}

      {studies.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {studies.map((study) => (
            <li key={study.id}>
              <button
                type="button"
                aria-pressed={studyId === study.id}
                onClick={() => onOpen(study.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs",
                  studyId === study.id
                    ? "border-accent bg-accent/10"
                    : "border-rule hover:border-accent",
                )}
              >
                {study.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      {naming && (
        <form onSubmit={onStart} className="mt-3">
          <label htmlFor="study-title" className="mb-1 block text-xs text-muted">
            What is the study called?
          </label>
          <input
            id="study-title"
            value={title}
            onChange={(event) => onTitle(event.target.value)}
            className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <label htmlFor="study-question" className="mb-1 block text-xs text-muted">
            The research question (optional)
          </label>
          <input
            id="study-question"
            value={question}
            onChange={(event) => onQuestion(event.target.value)}
            className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={title.trim() === ""}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            Start study
          </button>
        </form>
      )}
    </section>
  );
}

function Workspace({ store }: { store: ReturnType<typeof useQualitativeStudy> }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<View>("code");
  const [pasting, setPasting] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");

  const { documents, codes, codings, drafts } = store;
  const open = documents.find((document) => document.id === openId) ?? documents[0] ?? null;

  const texts = useMemo(
    () => new Map(documents.map((document) => [document.id, document.body])),
    [documents],
  );
  const counts = useMemo(() => {
    const tally = new Map<string, number>();
    for (const coding of codings) tally.set(coding.codeId, (tally.get(coding.codeId) ?? 0) + 1);
    return tally;
  }, [codings]);
  const together = useMemo(() => coOccurrence(codings), [codings]);
  // Read in the order documents were coded, which is what `coding_position`
  // records and the arrows below change. Never inferred: saturation is a claim
  // about a sequence, and a guessed one is a fact about the analysis that
  // nobody established.
  const saturation = useMemo(
    () => readSaturation(codings, documents.map((document) => document.id)),
    [codings, documents],
  );

  async function addDocument(event: React.FormEvent) {
    event.preventDefault();
    if (text.trim() === "") return;
    const named = name.trim() === "" ? `Document ${documents.length + 1}` : name.trim();
    await store.addDocument(named, text);
    setName("");
    setText("");
    setPasting(false);
  }

  const labelOf = (id: string) => codes.find((code) => code.id === id)?.label ?? id;
  const nameOf = (id: string) => documents.find((document) => document.id === id)?.name ?? id;

  return (
    <>
      <section className="rounded-lg border border-rule bg-raised p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-sm font-medium">Transcripts</h3>
          <label className="cursor-pointer rounded-lg border border-rule px-3 py-1.5 text-xs hover:border-accent">
            Upload a text file
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void file.text().then((body) => store.addDocument(file.name, body));
                event.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setPasting((was) => !was)}
            className="rounded-lg border border-rule px-3 py-1.5 text-xs hover:border-accent"
          >
            {pasting ? "Close" : "Paste one"}
          </button>
        </div>

        {documents.length === 0 && !pasting && (
          <p className="text-sm text-muted">
            An interview transcript, a set of open-ended responses, field notes. Plain text — the
            offsets a coding is stored as are offsets into exactly what you upload.
          </p>
        )}

        {documents.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {documents.map((document, index) => (
              <li key={document.id} className="flex items-center gap-1">
                <button
                  type="button"
                  aria-pressed={open?.id === document.id}
                  onClick={() => {
                    setOpenId(document.id);
                    setView("code");
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs",
                    open?.id === document.id
                      ? "border-accent bg-accent/10"
                      : "border-rule hover:border-accent",
                  )}
                >
                  {document.name}
                  <span className="ml-2 text-muted">
                    {codings.filter((coding) => coding.documentId === document.id).length}
                  </span>
                </button>
                {/* Arrows rather than drag-and-drop: this is the order the
                    documents were *coded*, which the researcher is recalling
                    rather than composing, and a keyboard-reachable control is
                    what an accessible reorder actually needs. */}
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => void store.moveDocument(document.id, -1)}
                  aria-label={`Move ${document.name} earlier in the coding order`}
                  className="rounded border border-rule px-1.5 py-1 text-[0.65rem] text-muted hover:border-accent disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === documents.length - 1}
                  onClick={() => void store.moveDocument(document.id, 1)}
                  aria-label={`Move ${document.name} later in the coding order`}
                  className="rounded border border-rule px-1.5 py-1 text-[0.65rem] text-muted hover:border-accent disabled:opacity-30"
                >
                  ↓
                </button>
              </li>
            ))}
          </ul>
        )}

        {pasting && (
          <form onSubmit={addDocument} className="mt-3">
            <label htmlFor="transcript-name" className="mb-1 block text-xs text-muted">
              Name it (optional)
            </label>
            <input
              id="transcript-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <label htmlFor="transcript-text" className="mb-1 block text-xs text-muted">
              The transcript
            </label>
            <textarea
              id="transcript-text"
              rows={8}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 font-serif text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={text.trim() === ""}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
            >
              Add transcript
            </button>
          </form>
        )}
      </section>

      {documents.length > 0 && (
        <>
          <nav aria-label="Qualitative view" className="flex flex-wrap gap-2">
            {VIEWS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={view === option.id}
                onClick={() => setView(option.id)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-left transition-colors",
                  view === option.id
                    ? "border-accent bg-accent/10"
                    : "border-rule bg-raised hover:border-muted",
                )}
              >
                <span className="block text-sm font-medium">{option.name}</span>
                <span className="block text-xs text-muted">{option.blurb}</span>
              </button>
            ))}
          </nav>

          {view === "code" && open && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <CodeDocument
                documentId={open.id}
                text={open.body}
                codes={codes}
                codings={codings}
                onCode={(coding) => void store.applyCoding(coding)}
                onUncode={(id) => void store.removeCoding(id)}
              />
              <Codebook
                codes={codes}
                counts={counts}
                onAdd={(code) => void store.addCode(code)}
                onRemove={(id) => void store.removeCode(id)}
              />
            </div>
          )}

          {view === "themes" && (
            <>
              <ThemeBoard
                codes={codes}
                codings={codings}
                documents={texts}
                drafts={drafts}
                onAdd={(draft) => void store.addDraft(draft)}
                onRemove={(id) => void store.removeDraft(id)}
              />
              {together.length > 0 && (
                <section className="rounded-lg border border-rule bg-raised p-4">
                  <h4 className="mb-2 text-sm font-medium">Codes applied to the same passage</h4>
                  <ul className="space-y-1">
                    {together.map((pair) => (
                      <li key={`${pair.a} ${pair.b}`} className="text-sm text-muted">
                        {labelOf(pair.a)} and {labelOf(pair.b)} — {pair.count} passage
                        {pair.count === 1 ? "" : "s"}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {view === "saturation" && (
            <section className="rounded-lg border border-rule bg-raised p-4">
              <h4 className="mb-2 text-sm font-medium">What the coding record shows</h4>
              <p className="font-serif text-sm">{saturation.account}</p>
              {saturation.newCodesPerDocument.length > 0 && (
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b border-rule text-left text-xs text-muted">
                      <th scope="col" className="pb-1 font-normal">Document</th>
                      <th scope="col" className="pb-1 text-right font-normal">New codes</th>
                      <th scope="col" className="pb-1 text-right font-normal">Running total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saturation.newCodesPerDocument.map((row) => (
                      <tr key={row.documentId} className="border-b border-rule/50">
                        <td className="py-1">{nameOf(row.documentId)}</td>
                        <td className="py-1 text-right">{row.newCodes}</td>
                        <td className="py-1 text-right text-muted">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-4 text-xs text-muted">
                Read in the order the transcripts are listed above, which is the order you say they
                were coded in — use the arrows to correct it. Whether it is enough is a judgement
                about your question and your field; this reports what the coding did, not whether it
                was sufficient.
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
