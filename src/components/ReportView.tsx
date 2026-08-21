import { useState } from "react";
import { Check, Copy, Quote } from "lucide-react";
import { FRAMEWORKS } from "@shared/diagnostic/frameworks.ts";
import { SECTION_TITLES, type DiagnosticReport, type Finding } from "@shared/diagnostic/report.ts";
import { cn } from "@/lib/utils.ts";

function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const framework = FRAMEWORKS[finding.framework];

  return (
    <li className="border-t border-rule pt-4 first:border-t-0 first:pt-0">
      <p className="text-[0.95rem] leading-relaxed">{finding.claim}</p>

      {finding.quotes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {finding.quotes.map((quote, index) => (
            <li
              key={index}
              className="flex gap-2 border-l-2 border-accent/50 pl-3 text-sm italic text-muted"
            >
              <Quote aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{quote}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 text-xs font-medium uppercase tracking-wider text-accent hover:underline"
      >
        {framework.name}
      </button>
      {open && (
        <div className="mt-2 rounded-md bg-paper p-3 text-sm text-muted">
          <p className="mb-1 text-xs uppercase tracking-wide">{framework.tradition}</p>
          <p className="leading-relaxed">{framework.gloss}</p>
        </div>
      )}
    </li>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-sm hover:bg-paper"
    >
      {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
      {copied ? "Copied" : "Copy rewrite"}
    </button>
  );
}

export function ReportView({ report }: { report: DiagnosticReport }) {
  return (
    <div className="space-y-4">
      {report.sections.map((section) => (
        <section
          key={section.id}
          className="rounded-lg border border-rule bg-raised p-5"
          aria-labelledby={`section-${section.id}`}
        >
          <h3
            id={`section-${section.id}`}
            className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted"
          >
            {SECTION_TITLES[section.id]}
          </h3>
          <p className="mb-4 leading-relaxed">{section.summary}</p>

          {section.findings.length > 0 ? (
            <ul className="space-y-4">
              {section.findings.map((finding, index) => (
                <FindingCard key={index} finding={finding} />
              ))}
            </ul>
          ) : (
            // An absence is a result. Saying nothing here would read as a
            // rendering bug; saying "nothing to report" is the finding.
            <p className="text-sm italic text-muted">
              Nothing structurally notable to report in this respect.
            </p>
          )}
        </section>
      ))}

      {report.rewrite && (
        <section
          className="rounded-lg border border-accent/40 bg-raised p-5"
          aria-labelledby="section-rewrite"
        >
          <h3
            id="section-rewrite"
            className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent"
          >
            Structurally revised
          </h3>
          <p className={cn("mb-4 whitespace-pre-wrap rounded-md bg-paper p-4 leading-relaxed")}>
            {report.rewrite.text}
          </p>
          <p className="mb-4 text-sm leading-relaxed text-muted">{report.rewrite.note}</p>
          <CopyButton text={report.rewrite.text} />
        </section>
      )}
    </div>
  );
}
