import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { EpistemicBadge } from "@/components/EpistemicBadge.tsx";
import { RequireSession } from "@/components/RequireSession.tsx";
import {
  getCase,
  listClaims,
  listSources,
  type CaseSummary,
  type ClaimRow,
  type SourceRow,
} from "@/lib/detective-api.ts";

function CaseDetail({ id }: { id: string }) {
  const [investigation, setInvestigation] = useState<CaseSummary | null | undefined>(undefined);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
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

      const [claimResult, sourceResult] = await Promise.all([listClaims(id), listSources(id)]);
      if (!active) return;
      if (claimResult.ok) setClaims(claimResult.data);
      if (sourceResult.ok) setSources(sourceResult.data);
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
            {claims.map((claim) => (
              <li key={claim.id} className="rounded-lg border border-rule bg-raised p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="leading-relaxed">{claim.statement}</p>
                  <EpistemicBadge status={claim.status} />
                </div>
                {claim.asserted_by && (
                  <p className="mt-2 text-sm text-muted">Asserted by {claim.asserted_by}</p>
                )}
              </li>
            ))}
          </ul>
        )}
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
