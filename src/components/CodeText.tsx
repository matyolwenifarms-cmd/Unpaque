import { useMemo, useState } from "react";
import type { Code } from "@shared/research/qualitative/codebook.ts";
import { coOccurrence, type Coding } from "@shared/research/qualitative/coding.ts";
import type { ThemeDraft } from "@shared/research/qualitative/themes.ts";
import { readSaturation } from "@shared/research/qualitative/saturation.ts";
import { CodeDocument } from "@/components/CodeDocument.tsx";
import { Codebook } from "@/components/Codebook.tsx";
import { ThemeBoard } from "@/components/ThemeBoard.tsx";
import { cn } from "@/lib/utils.ts";

interface Document {
  id: string;
  name: string;
  text: string;
}

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
 * The order of documents is the order they were added, and it is what
 * saturation is read from. It is not inferred anywhere: a claim about
 * saturation is a claim about a sequence, and a sequence the software guessed
 * is a fact about the analysis that nobody established.
 */
export function CodeText() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [codings, setCodings] = useState<Coding[]>([]);
  const [drafts, setDrafts] = useState<ThemeDraft[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<View>("code");
  const [pasting, setPasting] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");

  const open = documents.find((document) => document.id === openId) ?? documents[0] ?? null;

  const texts = useMemo(
    () => new Map(documents.map((document) => [document.id, document.text])),
    [documents],
  );
  const counts = useMemo(() => {
    const tally = new Map<string, number>();
    for (const coding of codings) tally.set(coding.codeId, (tally.get(coding.codeId) ?? 0) + 1);
    return tally;
  }, [codings]);
  const together = useMemo(() => coOccurrence(codings), [codings]);
  const saturation = useMemo(
    () => readSaturation(codings, documents.map((document) => document.id)),
    [codings, documents],
  );

  function addDocument(event: React.FormEvent) {
    event.preventDefault();
    if (text.trim() === "") return;
    const id = name.trim() === "" ? `Document ${documents.length + 1}` : name.trim();
    setDocuments((was) => [...was, { id, name: id, text }]);
    setOpenId(id);
    setName("");
    setText("");
    setPasting(false);
  }

  async function addFile(file: File) {
    const contents = await file.text();
    const id = file.name;
    setDocuments((was) => [...was, { id, name: id, text: contents }]);
    setOpenId(id);
  }

  const labelOf = (id: string) => codes.find((code) => code.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      {/* Said once, plainly, at the top. Coding is days of work and this holds
          none of it after a refresh; a researcher who discovers that by losing
          an afternoon will not use the feature again. Remove this notice in
          the same commit that adds persistence, and not before. */}
      <p className="rounded-lg border border-rule bg-raised p-3 text-sm text-muted">
        Nothing here is saved yet. Transcripts, codes and themes live in this browser tab only, and
        closing or refreshing it loses them.
      </p>

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
                if (file) void addFile(file);
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
            {documents.map((document) => (
              <li key={document.id}>
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
                text={open.text}
                codes={codes}
                codings={codings}
                onCode={(coding) => setCodings((was) => [...was, coding])}
                onUncode={(id) => setCodings((was) => was.filter((coding) => coding.id !== id))}
              />
              <Codebook
                codes={codes}
                counts={counts}
                onAdd={(code) => setCodes((was) => [...was, code])}
                onRemove={(id) => {
                  setCodes((was) => was.filter((code) => code.id !== id));
                  // The codings go with it. Leaving them would put extracts on
                  // screen under a code that no longer has a definition, which
                  // is the state the codebook exists to prevent.
                  setCodings((was) => was.filter((coding) => coding.codeId !== id));
                  setDrafts((was) =>
                    was.map((draft) => ({
                      ...draft,
                      codeIds: draft.codeIds.filter((codeId) => codeId !== id),
                    })),
                  );
                }}
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
                onDrafts={setDrafts}
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
                        <td className="py-1">{row.documentId}</td>
                        <td className="py-1 text-right">{row.newCodes}</td>
                        <td className="py-1 text-right text-muted">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* The sentence the coherence checker refuses a study for not
                  having. It is deliberately not a verdict. */}
              <p className="mt-4 text-xs text-muted">
                Read in the order transcripts were added. Whether it is enough is a judgement about
                your question and your field; this reports what the coding did, not whether it was
                sufficient.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
