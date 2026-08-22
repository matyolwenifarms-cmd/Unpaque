import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { descriptivesTable, resultsSection } from "@shared/research/analytics/apa.ts";
import type { Descriptives } from "@shared/research/analytics/describe.ts";
import type { Finding } from "@shared/research/analytics/result.ts";

/**
 * The results section, assembled from the analyses that have actually been run.
 *
 * Rebuilt from the findings on every render rather than accumulated as text.
 * A results section held as a string drifts from the analyses the moment one is
 * re-run with a different variable, and the drift is invisible — the numbers in
 * the prose stay plausible, they are simply from an earlier version of the
 * study. Here there is nothing to drift: the prose is a function of the
 * findings.
 *
 * There is no Discussion. That is §8 and not an omission — interpretation is
 * the researcher's argument, and a tool that drafted it would be one
 * positioning decision from producing work a student submits as their own.
 */
export function ResultsSection({
  findings,
  descriptives,
  rowsInFile,
}: {
  findings: Finding[];
  descriptives: Array<{ label: string; stats: Descriptives }>;
  rowsInFile: number;
}) {
  const [copied, setCopied] = useState(false);
  const markdown = [
    resultsSection({ findings, descriptives, rowsInFile }),
    descriptivesTable(descriptives),
  ]
    .filter((part) => part.trim() !== "")
    .join("\n\n");

  return (
    <section aria-labelledby="results" className="rounded-lg border border-rule bg-raised p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id="results" className="text-xs font-semibold uppercase tracking-widest text-muted">
          Results section
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
              // A blob rather than a data: URL — a results section with a long
              // table exceeds what some browsers accept in a data URL, and it
              // fails by doing nothing at all.
              const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "results.md";
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
        APA 7. Written from the analyses above — the statistics, their assumptions and what a
        non-significant result does not mean. It stops at the results: the discussion is your
        argument, not a formatting problem.
      </p>

      {/* Monospace and pre-wrapped: this is text to be taken away, and showing
          it rendered would hide the markdown a reader is about to paste. */}
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-paper p-4 font-mono text-xs leading-relaxed">
        {markdown}
      </pre>
    </section>
  );
}
