import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  assembleWriteUp,
  renderWriteUp,
  type Supplied,
} from "@shared/research/writeup/document.ts";

/**
 * The report skeleton, and what it will not write.
 *
 * The screen makes the same split the module does, visibly: sections
 * assembled from work already done, sections waiting on work not done yet, and
 * sections nothing here will ever write. A researcher who cannot see which is
 * which will assume the document is a draft with some blanks in it.
 */
export function WriteUp({ title, supplied }: { title: string; supplied: Supplied }) {
  const document = useMemo(() => assembleWriteUp(title, supplied), [title, supplied]);
  const markdown = useMemo(() => renderWriteUp(document), [document]);
  const [copied, setCopied] = useState(false);

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${document.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "write-up"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-rule bg-raised p-4">
        <h3 className="text-sm font-medium">{document.title}</h3>
        {/* The counts, before anything else. The single most likely misreading
            of this screen is that it produced a report. */}
        <p className="mt-1 text-sm text-muted">
          {document.transcribed} of {document.sections.length} sections are assembled from work you
          have done.{" "}
          {document.waiting > 0 && (
            <>
              {document.waiting} {document.waiting === 1 ? "is" : "are"} waiting on work not done
              yet.{" "}
            </>
          )}
          The remaining {document.yours} are yours — nothing here writes an introduction, a
          literature argument, a discussion or a conclusion.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download as Markdown
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-lg border border-rule px-4 py-2 text-sm hover:border-accent"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </section>

      {document.sections.map((section) => (
        <article key={section.id} className="rounded-lg border border-rule bg-raised p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-medium">{section.title}</h4>
            <span className="text-xs text-muted">
              {section.kind === "transcribed"
                ? "assembled"
                : section.kind === "waiting"
                  ? "not written yet"
                  : "yours to write"}
            </span>
          </div>

          {section.kind === "transcribed" ? (
            <>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-serif text-sm">
                {section.markdown.trim()}
              </pre>
              <p className="mt-2 text-xs text-muted">Assembled from: {section.from}</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">{section.says}</p>
              {section.kind === "yours" && (
                <p className="mt-2 text-sm text-muted">{section.because}</p>
              )}
            </>
          )}
        </article>
      ))}
    </div>
  );
}
