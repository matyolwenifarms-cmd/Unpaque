import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { RequireSession } from "@/components/RequireSession.tsx";
import { createCase, listCases, type CaseSummary } from "@/lib/detective-api.ts";

function CaseList() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void listCases().then((result) => {
      if (!active) return;
      if (result.ok) setCases(result.data);
      else setError(result.message);
    });
    return () => {
      active = false;
    };
  }, []);

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (busy || title.trim() === "") return;
    setBusy(true);
    setError(null);
    const result = await createCase(title, question);
    if (result.ok) {
      setCases((current) => [result.data, ...(current ?? [])]);
      setTitle("");
      setQuestion("");
    } else {
      setError(result.message);
    }
    setBusy(false);
  }

  return (
    <div>
      <form onSubmit={onCreate} className="mb-8 rounded-lg border border-rule bg-raised p-4">
        <h3 className="mb-3 font-medium">Open a case</h3>
        <input
          aria-label="Case title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What is the investigation called?"
          className="mb-2 w-full rounded-lg border border-rule bg-paper px-4 py-2.5 outline-none focus:border-accent"
        />
        <input
          aria-label="Case question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What do you want to know? (optional)"
          className="mb-3 w-full rounded-lg border border-rule bg-paper px-4 py-2.5 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || title.trim() === ""}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-40"
        >
          {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Plus aria-hidden className="h-4 w-4" />}
          Begin investigation
        </button>
        <p className="mt-2 text-xs text-muted">
          Private to you until you explicitly publish it. Sharing a link grants nobody access.
        </p>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-rule bg-raised p-4">
          <p>{error}</p>
        </div>
      )}

      {cases === null && !error && <p className="text-sm text-muted">Loading your cases…</p>}

      {cases?.length === 0 && (
        <p className="text-sm text-muted">No cases yet. The one above is where to start.</p>
      )}

      {cases && cases.length > 0 && (
        <ul className="space-y-2">
          {cases.map((investigation) => (
            <li key={investigation.id}>
              <Link
                to={`/cases/${investigation.id}`}
                className="block rounded-lg border border-rule bg-raised p-4 hover:border-muted"
              >
                <span className="font-medium">{investigation.title}</span>
                {investigation.question && (
                  <span className="mt-1 block text-sm text-muted">{investigation.question}</span>
                )}
                <span className="mt-2 block text-xs text-muted">
                  {investigation.visibility === "published" ? "Published" : "Private"} ·{" "}
                  {new Date(investigation.created_at).toLocaleDateString("en-GB")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Cases() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Detect</h1>
        <p className="mt-1 text-sm text-muted">
          What does the available evidence actually allow us to say? What remains unknown?
        </p>
      </header>
      <RequireSession>
        <CaseList />
      </RequireSession>
    </div>
  );
}
