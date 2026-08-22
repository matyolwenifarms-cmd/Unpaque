import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AddClaim } from "@/components/AddClaim.tsx";
import { AddEvent } from "@/components/AddEvent.tsx";
import { AddSource } from "@/components/AddSource.tsx";
import { EpistemicBadge } from "@/components/EpistemicBadge.tsx";
import { LinkEvidence } from "@/components/LinkEvidence.tsx";
import { Timeline } from "@/components/Timeline.tsx";
import { RequireSession } from "@/components/RequireSession.tsx";
import {
  getCase,
  listClaims,
  listEvents,
  listEvidence,
  listSources,
  type CaseSummary,
  type ClaimRow,
  type EventRow,
  type EvidenceRow,
  type SourceRow,
} from "@/lib/detective-api.ts";
import { mayBeCorroborated } from "@shared/detective/epistemic.ts";

function CaseDetail({ id }: { id: string }) {
  const [investigation, setInvestigation] = useState<CaseSummary | null | undefined>(undefined);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const found = await getCase(id);
      if (!active) return;
      if (!found.ok) {
        setError(found.message);
        return;
      }
      setInvestigation(found.data);
      if (!found.data) return;

      const [claimResult, sourceResult, evidenceResult, eventResult] = await Promise.all([
        listClaims(id), listSources(id), listEvidence(id), listEvents(id),
      ]);
      if (!active) return;
      if (claimResult.ok) setClaims(claimResult.data);
      if (sourceResult.ok) setSources(sourceResult.data);
      if (evidenceResult.ok) setEvidence(evidenceResult.data);
      if (eventResult.ok) setEvents(eventResult.data);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="rounded-lg border border-rule bg-raised p-5">
        <p>{error}</p>
      </div>
    );
  }

  if (investigation === undefined) return <p className="text-sm text-muted">Opening the case…</p>;

  // Row level security returns no row for a case somebody may not read, which is
  // indistinguishable from one that does not exist — and that is the intended
  // behaviour, not a gap. §18 requires a private case to be inaccessible even to
  // somebody holding its id, and confirming existence would breach exactly that.
  if (investigation === null) {
    return (
      <div className="rounded-lg border border-rule bg-raised p-5">
        <p className="leading-relaxed">
          No case here. Either it does not exist, or it is private and not shared with you —
          Unpaque deliberately does not say which.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xl font-bold tracking-tight">{investigation.title}</h3>
      {investigation.question && (
        <p className="mt-1 text-muted">{investigation.question}</p>
      )}

      <section className="mt-8" aria-labelledby="claims-heading">
        <h4 id="claims-heading" className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Claims
        </h4>
        {claims.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing recorded yet. A claim is something that needs examining — kept separate from
            the evidence for and against it.
          </p>
        ) : (
          <ul className="space-y-2">
            {claims.map((claim) => {
              const forClaim = evidence.filter((row) => row.claim_id === claim.id);
              const named = (sourceId: string) =>
                sources.find((source) => source.id === sourceId)?.title ?? "a source";
              const corroboratable = mayBeCorroborated(
                forClaim.map((row) => ({ sourceId: row.source_id, classification: row.classification })),
              );
              return (
                <li key={claim.id} className="rounded-lg border border-rule bg-raised p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="leading-relaxed">{claim.statement}</p>
                    <EpistemicBadge status={claim.status} />
                  </div>
                  {claim.asserted_by && (
                    <p className="mt-2 text-sm text-muted">Asserted by {claim.asserted_by}</p>
                  )}

                  {forClaim.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm">
                      {forClaim.map((row) => (
                        <li key={row.id} className="text-muted">
                          <span className="font-medium">{row.classification.replace(/_/g, " ")}</span>
                          {" — "}
                          {named(row.source_id)}
                          {row.excerpt && <span className="italic"> “{row.excerpt}”</span>}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Stated as permission, never applied. §4 keeps human
                      authority explicit, and moving a claim because a count
                      crossed two is precisely the collapse into truth the
                      epistemic model exists to prevent. */}
                  {corroboratable && claim.status !== "corroborated" && (
                    <p className="mt-3 text-xs text-accent">
                      Two independent sources support this. You may mark it corroborated — Unpaque
                      will not.
                    </p>
                  )}

                  <LinkEvidence
                    caseId={id}
                    claimId={claim.id}
                    sources={sources}
                    onLinked={(row) => setEvidence((current) => [...current, row])}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4">
          <AddClaim caseId={id} onAdded={(claim) => setClaims((current) => [...current, claim])} />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="sources-heading">
        <h4 id="sources-heading" className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Sources
        </h4>
        {sources.length === 0 ? (
          <p className="text-sm text-muted">No sources yet.</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((source) => (
              <li key={source.id} className="rounded-lg border border-rule bg-raised p-4">
                <p className="font-medium">{source.title}</p>
                <p className="mt-1 text-sm text-muted">{source.kind.replace(/_/g, " ")}</p>
                {/* Provenance is shown, always. A source whose origin is not on
                    screen is one nobody will check. */}
                <p className="mt-2 text-xs text-muted">
                  From {source.retrieved_from} · retrieved{" "}
                  {new Date(source.retrieved_at).toLocaleDateString("en-GB")}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <AddSource caseId={id} onAdded={(source) => setSources((current) => [source, ...current])} />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="timeline-heading">
        <h4 id="timeline-heading" className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Timeline
        </h4>
        <Timeline events={events} sources={sources} />
        <div className="mt-4">
          <AddEvent
            caseId={id}
            sources={sources}
            onAdded={(event) => setEvents((current) => [...current, event])}
          />
        </div>
      </section>
    </div>
  );
}

export default function CaseView() {
  const { id } = useParams<{ id: string }>();
  return (
    <div>
      <Link to="/cases" className="mb-6 inline-flex items-center gap-1 text-sm text-accent hover:underline">
        <ArrowLeft aria-hidden className="h-4 w-4" />
        All cases
      </Link>
      <RequireSession>{id ? <CaseDetail id={id} /> : <p>No case named.</p>}</RequireSession>
    </div>
  );
}
