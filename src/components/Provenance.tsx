import { useMemo, useState } from "react";
import {
  LINEAGE_KINDS,
  provenanceOf,
  readLineage,
  type LineageKind,
  type LineageLink,
  type ProvenanceEvidence,
} from "@shared/detective/provenance.ts";
import type { ClaimRow, EvidenceRow, LineageRow, SourceRow } from "@/lib/detective-api.ts";

/**
 * Where each claim comes from, and how many sources really stand behind it.
 *
 * Two of §6's requirements on one screen, because they are the same question.
 * The path — CLAIM-031 -> SOURCE-017 -> DOCUMENT -> PAGE 42 — is drawn
 * with its gaps named rather than shortened, and the lineage beneath it says
 * how much of the apparent corroboration is one report republished.
 */
export function Provenance({
  claims,
  sources,
  evidence,
  lineage,
  onDeclare,
  onWithdraw,
}: {
  claims: readonly ClaimRow[];
  sources: readonly SourceRow[];
  evidence: readonly EvidenceRow[];
  lineage: readonly LineageRow[];
  onDeclare: (input: {
    sourceId: string;
    derivesFromId: string;
    kind: LineageKind;
    note: string;
  }) => void;
  onWithdraw: (id: string) => void;
}) {
  const links: LineageLink[] = useMemo(
    () => lineage.map((row) => ({
      sourceId: row.source_id,
      derivesFromId: row.derives_from_id,
      kind: row.kind,
    })),
    [lineage],
  );
  const titleOf = (id: string) => sources.find((source) => source.id === id)?.title ?? "a source";

  return (
    <div className="space-y-4">
      {claims.length === 0 ? (
        <p className="text-sm text-muted">No claims yet, so there is nothing to trace.</p>
      ) : (
        claims.map((claim) => {
          const mine = evidence.filter((item) => item.claim_id === claim.id);
          const paths = provenanceOf(
            claim,
            mine.map<ProvenanceEvidence>((item) => ({
              sourceId: item.source_id,
              classification: item.classification,
              locator: item.locator,
              excerpt: item.excerpt,
            })),
            sources.map((source) => ({
              id: source.id,
              reference: source.reference,
              title: source.title,
              kind: source.kind,
            })),
          );
          const reading = readLineage(
            [...new Set(mine.map((item) => item.source_id))],
            links,
            titleOf,
          );

          return (
            <article key={claim.id} className="rounded-lg border border-rule bg-raised p-4">
              <h5 className="text-sm font-medium">{claim.statement}</h5>
              <ul className="mt-2 space-y-1">
                {paths.map((path, index) => (
                  <li key={index} className="text-xs">
                    {path.map((step, position) => (
                      <span key={position}>
                        {position > 0 && <span className="mx-1 text-muted">&rarr;</span>}
                        {/* A gap is shown as a gap. The alternative — a shorter
                            path — reads as a complete one, and the whole point
                            of drawing it is that somebody can see where it
                            stops. */}
                        <span className={step.absent ? "text-muted italic" : ""}>{step.label}</span>
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
              {reading.says && <p className="mt-2 text-sm text-muted">{reading.says}</p>}
            </article>
          );
        })
      )}

      <Lineage
        sources={sources}
        lineage={lineage}
        onDeclare={onDeclare}
        onWithdraw={onWithdraw}
      />
    </div>
  );
}

function Lineage({
  sources,
  lineage,
  onDeclare,
  onWithdraw,
}: {
  sources: readonly SourceRow[];
  lineage: readonly LineageRow[];
  onDeclare: (input: {
    sourceId: string;
    derivesFromId: string;
    kind: LineageKind;
    note: string;
  }) => void;
  onWithdraw: (id: string) => void;
}) {
  const [sourceId, setSourceId] = useState("");
  const [derivesFromId, setDerivesFromId] = useState("");
  const [kind, setKind] = useState<LineageKind>("syndication");
  const [note, setNote] = useState("");

  const titleOf = (id: string) => sources.find((source) => source.id === id)?.title ?? "a source";
  const ready = sourceId !== "" && derivesFromId !== "" && sourceId !== derivesFromId;

  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <h4 className="text-sm font-medium">Where a report came from</h4>
      {/* Said once, at the top. Somebody about to declare this is making a
          claim about two newsrooms. */}
      <p className="mt-1 text-xs text-muted">
        Declared by you, never guessed at. Saying one report derives from another is a claim about
        how it was written, and nothing here is in a position to make it.
      </p>

      {lineage.length > 0 && (
        <ul className="mt-3 space-y-2">
          {lineage.map((row) => (
            <li key={row.id} className="rounded border border-rule bg-paper p-2 text-xs">
              <p>
                {titleOf(row.source_id)}{" "}
                <span className="text-muted">{row.kind.replace(/_/g, " ")} of</span>{" "}
                {titleOf(row.derives_from_id)}
              </p>
              {row.note && <p className="mt-0.5 text-muted">{row.note}</p>}
              <button
                type="button"
                onClick={() => onWithdraw(row.id)}
                className="mt-1 text-muted underline hover:text-ink"
              >
                Withdraw
              </button>
            </li>
          ))}
        </ul>
      )}

      {sources.length < 2 ? (
        <p className="mt-3 text-xs text-muted">Two sources are needed before one can derive from another.</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            onDeclare({ sourceId, derivesFromId, kind, note });
            setSourceId("");
            setDerivesFromId("");
            setNote("");
          }}
          className="mt-3"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Pick id="lineage-source" label="This source" value={sourceId} onChange={setSourceId} sources={sources} />
            <div>
              <label htmlFor="lineage-kind" className="mb-1 block text-xs text-muted">
                is a
              </label>
              <select
                id="lineage-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as LineageKind)}
                className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {LINEAGE_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <Pick id="lineage-origin" label="of" value={derivesFromId} onChange={setDerivesFromId} sources={sources} />
          </div>
          <input
            value={note}
            aria-label="What makes you think so"
            placeholder="What makes you think so?"
            onChange={(event) => setNote(event.target.value)}
            className="mt-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!ready}
            className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            Declare it
          </button>
        </form>
      )}
    </section>
  );
}

function Pick({
  id,
  label,
  value,
  onChange,
  sources,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  sources: readonly SourceRow[];
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
      >
        <option value="">Choose a source</option>
        {sources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.title}
          </option>
        ))}
      </select>
    </div>
  );
}
