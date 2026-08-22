import { useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import {
  assembleDossier,
  type DossierClaim,
  type DossierEvent,
} from "@shared/detective/dossier.ts";
import { writeDossier } from "@shared/detective/write.ts";
import type {
  CaseSummary,
  ClaimRow,
  EvidenceRow,
  EventRow,
  SourceRow,
} from "@/lib/detective-api.ts";

/**
 * The document the case is for.
 *
 * Assembled from the rows on every render rather than stored. A dossier held
 * as text is a dossier that goes on saying what the file used to say — and in
 * an investigation that is worse than having none, because it reads as
 * current. Here it cannot be stale: it is a function of the rows on screen.
 *
 * Nothing is written back either. In particular no claim's status changes
 * because a support count crossed two — §4 keeps that decision with a person,
 * and a tool that promoted claims quietly would be the collapse into truth the
 * epistemic model exists to prevent.
 */
export function DossierView({
  investigation,
  claims,
  sources,
  evidence,
  events,
}: {
  investigation: CaseSummary;
  claims: ClaimRow[];
  sources: SourceRow[];
  evidence: EvidenceRow[];
  events: EventRow[];
}) {
  const [copied, setCopied] = useState(false);

  const markdown = useMemo(() => {
    const titleOf = new Map(sources.map((source) => [source.id, source.title]));
    const hashOf = new Map(sources.map((source) => [source.id, source.content_hash]));

    const dossierClaims: DossierClaim[] = claims.map((claim) => ({
      id: claim.id,
      statement: claim.statement,
      status: claim.status,
      assertedBy: claim.asserted_by,
      evidence: evidence
        .filter((item) => item.claim_id === claim.id)
        .map((item) => ({
          sourceId: item.source_id,
          classification: item.classification,
          contentHash: hashOf.get(item.source_id) ?? null,
          sourceTitle: titleOf.get(item.source_id) ?? "an unnamed source",
          excerpt: item.excerpt,
        })),
    }));

    const dossierEvents: DossierEvent[] = events.map((event) => ({
      id: event.id,
      label: event.label,
      at: event.occurred_at,
      certainty: event.certainty,
      origin: event.origin,
      sourceId: event.source_id,
      moment: event.moment,
      ...(event.tolerance_minutes === null ? {} : { toleranceMinutes: event.tolerance_minutes }),
    }));

    return writeDossier(
      assembleDossier({
        title: investigation.title,
        question: investigation.question,
        claims: dossierClaims,
        sources: sources.map((source) => ({
          id: source.id,
          title: source.title,
          kind: source.kind,
          retrievedFrom: source.retrieved_from,
          contentHash: source.content_hash,
        })),
        events: dossierEvents,
      }),
    );
  }, [investigation, claims, sources, evidence, events]);

  return (
    <section aria-labelledby="dossier" className="rounded-lg border border-rule bg-raised p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id="dossier" className="text-xs font-semibold uppercase tracking-widest text-muted">
          Dossier
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
              link.download = `${investigation.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
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
        What the file supports, what it does not, what remains unknown, and what does not fit.
        Assembled from the records above — it concludes nothing, and it is rebuilt every time this
        page draws, so it cannot go on saying what the file used to say.
      </p>

      <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md bg-paper p-4 font-mono text-xs leading-relaxed">
        {markdown}
      </pre>
    </section>
  );
}
