import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AddClaim } from "@/components/AddClaim.tsx";
import { AddEvent } from "@/components/AddEvent.tsx";
import { AddSource } from "@/components/AddSource.tsx";
import { CaseGraph } from "@/components/CaseGraph.tsx";
import { DossierView } from "@/components/DossierView.tsx";
import { Hypotheses } from "@/components/Hypotheses.tsx";
import { Provenance } from "@/components/Provenance.tsx";
import { UploadPortal } from "@/components/UploadPortal.tsx";
import { EpistemicBadge } from "@/components/EpistemicBadge.tsx";
import { LinkEvidence } from "@/components/LinkEvidence.tsx";
import { Timeline } from "@/components/Timeline.tsx";
import { RequireSession } from "@/components/RequireSession.tsx";
import type { Graph } from "@shared/detective/graph.ts";
import {
  createEdge,
  createEntity,
  createUploadedSource,
  declareLineage,
  createHypothesis,
  deleteEdge,
  deleteEntity,
  deleteHypothesis,
  linkHypothesisEvidence,
  listEdges,
  listEntities,
  listHypotheses,
  listHypothesisEvidence,
  listLineage,
  storeDocumentText,
  unlinkHypothesisEvidence,
  withdrawLineage,
  type EdgeRow,
  type EntityRow,
  type HypothesisEvidenceRow,
  type HypothesisRow,
  type LineageRow,
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
  const [hypotheses, setHypotheses] = useState<HypothesisRow[]>([]);
  const [hypothesisEvidence, setHypothesisEvidence] = useState<HypothesisEvidenceRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [edges, setEdges] = useState<EdgeRow[]>([]);
  const [lineage, setLineage] = useState<LineageRow[]>([]);
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

      const [
        claimResult, sourceResult, evidenceResult, eventResult,
        hypothesisResult, linkResult, entityResult, edgeResult, lineageResult,
      ] = await Promise.all([
        listClaims(id), listSources(id), listEvidence(id), listEvents(id),
        listHypotheses(id), listHypothesisEvidence(id), listEntities(id), listEdges(id),
        listLineage(id),
      ]);
      if (!active) return;
      if (claimResult.ok) setClaims(claimResult.data);
      if (sourceResult.ok) setSources(sourceResult.data);
      if (evidenceResult.ok) setEvidence(evidenceResult.data);
      if (eventResult.ok) setEvents(eventResult.data);
      if (hypothesisResult.ok) setHypotheses(hypothesisResult.data);
      if (linkResult.ok) setHypothesisEvidence(linkResult.data);
      if (entityResult.ok) setEntities(entityResult.data);
      if (edgeResult.ok) setEdges(edgeResult.data);
      if (lineageResult.ok) setLineage(lineageResult.data);
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

  // Assembled from the four record types the graph can reach, so a node and
  // the row it came from cannot drift apart. Built here rather than in the
  // component because the component takes a graph, not eight lists — and a
  // component that assembles its own data is one that cannot be tested without
  // all eight.
  const graph: Graph = {
    nodes: [
      ...entities.map((entity) => ({
        kind: "entity" as const,
        id: entity.id,
        label: entity.display_name,
        entityKind: entity.kind,
        sensitive: entity.sensitive,
      })),
      ...events.map((event) => ({ kind: "event" as const, id: event.id, label: event.label })),
      ...claims.map((claim) => ({ kind: "claim" as const, id: claim.id, label: claim.statement })),
      ...sources.map((source) => ({ kind: "source" as const, id: source.id, label: source.title })),
    ],
    edges: edges.flatMap((edge) => {
      const endpoint = (
        entityId: string | null, eventId: string | null,
        claimId: string | null, sourceId: string | null,
      ) =>
        entityId
          ? { kind: "entity" as const, id: entityId }
          : eventId
            ? { kind: "event" as const, id: eventId }
            : claimId
              ? { kind: "claim" as const, id: claimId }
              : sourceId
                ? { kind: "source" as const, id: sourceId }
                : null;
      const from = endpoint(
        edge.source_entity_id, edge.source_event_id, edge.source_claim_id, edge.source_source_id,
      );
      const to = endpoint(
        edge.target_entity_id, edge.target_event_id, edge.target_claim_id, edge.target_source_id,
      );
      // The database refuses an edge with no endpoints, so this cannot happen;
      // it is dropped rather than coerced because a half-endpointed edge drawn
      // on a screen is a line to nowhere that still reads as a connection.
      if (!from || !to) return [];
      return [{
        id: edge.id,
        relation: edge.relation,
        from,
        to,
        status: edge.status,
        establishedBy: edge.established_by,
        note: edge.note,
      }];
    }),
  };



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
      <h1 className="text-xl font-bold tracking-tight">{investigation.title}</h1>
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
        {/* Above the one-at-a-time form, because the ordinary case is a folder
            and the exceptional one is a single URL. */}
        <div className="mt-4">
          <UploadPortal
            onImport={(confirmed) => {
              void (async () => {
                for (const item of confirmed) {
                  const made = await createUploadedSource(id, {
                    kind: item.kind,
                    title: item.name,
                    ...(item.within === undefined ? {} : { within: item.within }),
                    contentHash: item.contentHash,
                  });
                  if (!made.ok) {
                    setError(made.message);
                    return;
                  }
                  setSources((current) => [made.data, ...current]);
                  if (item.pageCount > 0) {
                    // The pages, so a locator can say "page 42". Sequential
                    // rather than parallel: a folder of forty files fired at
                    // once is forty concurrent inserts and a rate limit, and
                    // the person is watching a list fill in either way.
                    const stored = await storeDocumentText(id, made.data.id, item.pages);
                    if (!stored.ok) setError(stored.message);
                  }
                }
              })();
            }}
          />
        </div>

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

      {/* After the sources it traces and before the graph that is drawn from
          them: §6's "never create an orphaned statement with no source
          relationship", rendered. */}
      <section className="mt-8" aria-labelledby="provenance-heading">
        <h4 id="provenance-heading" className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Where each claim comes from
        </h4>
        <Provenance
          claims={claims}
          sources={sources}
          evidence={evidence}
          lineage={lineage}
          onDeclare={(input) => {
            void declareLineage(id, input).then((result) => {
              if (result.ok) setLineage((current) => [...current, result.data]);
              else setError(result.message);
            });
          }}
          onWithdraw={(lineageId) => {
            void withdrawLineage(lineageId).then((result) => {
              if (!result.ok) return setError(result.message);
              setLineage((current) => current.filter((row) => row.id !== lineageId));
            });
          }}
        />
      </section>

      {/* The graph reads the records above it, so it sits after them and
          before the explanations that are argued from it. */}
      {/* The route exists to be pointed at by a capture source, but a route
          with no link is a route nobody finds. */}
      <p className="mt-6 text-sm text-muted">
        <Link to={`/cases/${id}/broadcast`} className="underline hover:text-ink">
          Open this case in broadcast mode
        </Link>{" "}
        — 16:9, title-safe, keyboard-driven.
      </p>

      <section className="mt-8" aria-labelledby="graph-heading">
        <h4 id="graph-heading" className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          The case graph
        </h4>
        <CaseGraph
          graph={graph}
          entities={entities}
          sources={sources}
          onAddEntity={(input) => {
            void createEntity(id, input).then((result) => {
              if (result.ok) setEntities((current) => [...current, result.data]);
              else setError(result.message);
            });
          }}
          onRemoveEntity={(entityId) => {
            void deleteEntity(entityId).then((result) => {
              if (!result.ok) return setError(result.message);
              setEntities((current) => current.filter((row) => row.id !== entityId));
              setEdges((current) =>
                current.filter(
                  (row) => row.source_entity_id !== entityId && row.target_entity_id !== entityId,
                ),
              );
            });
          }}
          onAddEdge={(input) => {
            void createEdge(id, input).then((result) => {
              if (result.ok) setEdges((current) => [...current, result.data]);
              else setError(result.message);
            });
          }}
          onRemoveEdge={(edgeId) => {
            void deleteEdge(edgeId).then((result) => {
              if (!result.ok) return setError(result.message);
              setEdges((current) => current.filter((row) => row.id !== edgeId));
            });
          }}
        />
      </section>

      {/* Before the dossier and after the records, which is where it belongs:
          the explanations are read from the records above and the dossier is
          read from everything. */}
      <section className="mt-8" aria-labelledby="hypotheses-heading">
        <h4 id="hypotheses-heading" className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Explanations
        </h4>
        <Hypotheses
          drafts={hypotheses}
          sources={sources}
          evidence={hypothesisEvidence.map((link) => ({
            id: link.id,
            hypothesisId: link.hypothesis_id,
            sourceId: link.source_id,
            classification: link.classification,
            summary: link.summary,
            sourceTitle: sources.find((source) => source.id === link.source_id)?.title ?? "Unknown source",
            // The hash is what makes a wire story printed twice count once.
            contentHash: sources.find((source) => source.id === link.source_id)?.content_hash ?? null,
          }))}
          onAdd={(draft) => {
            void createHypothesis(id, draft).then((result) => {
              if (result.ok) setHypotheses((current) => [...current, result.data]);
              else setError(result.message);
            });
          }}
          onRemove={(hypothesisId) => {
            void deleteHypothesis(hypothesisId).then((result) => {
              if (!result.ok) return setError(result.message);
              setHypotheses((current) => current.filter((row) => row.id !== hypothesisId));
              setHypothesisEvidence((current) =>
                current.filter((row) => row.hypothesis_id !== hypothesisId),
              );
            });
          }}
          onLink={(input) => {
            void linkHypothesisEvidence(id, input).then((result) => {
              if (result.ok) setHypothesisEvidence((current) => [...current, result.data]);
              else setError(result.message);
            });
          }}
          onUnlink={(linkId) => {
            void unlinkHypothesisEvidence(linkId).then((result) => {
              if (!result.ok) return setError(result.message);
              setHypothesisEvidence((current) => current.filter((row) => row.id !== linkId));
            });
          }}
        />
      </section>

      {/* Last on the page, because it is a reading of everything above it. A
          document that appeared before the records it summarises would be read
          as the case rather than as an account of the case. */}
      <div className="mt-8">
        <DossierView
          investigation={investigation}
          claims={claims}
          sources={sources}
          evidence={evidence}
          events={events}
        />
      </div>
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
