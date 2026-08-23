import { useMemo, useState } from "react";
import {
  neighboursOf,
  nodeKey,
  pathsBetween,
  readPath,
  unconnected,
  unsourcedEdges,
  type Graph,
  type GraphNode,
} from "@shared/detective/graph.ts";
import { EPISTEMIC_STATUSES, type EpistemicStatus } from "@shared/detective/epistemic.ts";
import type { EntityRow, SourceRow } from "@/lib/detective-api.ts";
import { cn } from "@/lib/utils.ts";

const RELATIONS = [
  "knows", "contacted", "visited", "owns", "works_for", "travelled_to",
  "witnessed", "mentioned", "contradicts", "corroborates",
  "occurred_before", "occurred_after", "geographically_connected_to",
] as const;

const ENTITY_KINDS = [
  { id: "person", name: "Person" },
  { id: "organisation", name: "Organisation" },
  { id: "location", name: "Location" },
] as const;

/**
 * The case graph: who and what, and how they connect.
 *
 * Two things on this screen are refusals rather than features. A path is
 * reported with the weakest status along it, because a chain of three
 * unverified links looks exactly like a chain of three established ones once
 * it is drawn — and nobody re-reads the provenance of a line they can see.
 * And nothing is scored: no most-connected person, no centrality, because a
 * number beside a name in an investigation is read as suspicion.
 */
export function CaseGraph({
  graph,
  entities,
  sources,
  onAddEntity,
  onRemoveEntity,
  onAddEdge,
  onRemoveEdge,
}: {
  graph: Graph;
  entities: readonly EntityRow[];
  sources: readonly SourceRow[];
  onAddEntity: (input: {
    kind: EntityRow["kind"];
    displayName: string;
    aliases: string[];
    roleInCase: string;
    sensitive: boolean;
  }) => void;
  onRemoveEntity: (id: string) => void;
  onAddEdge: (input: {
    relation: string;
    from: { kind: string; id: string };
    to: { kind: string; id: string };
    status: EpistemicStatus;
    establishedBy: string | null;
    note: string;
  }) => void;
  onRemoveEdge: (id: string) => void;
}) {
  const loose = useMemo(() => unconnected(graph), [graph]);
  const unsourced = useMemo(() => unsourcedEdges(graph), [graph]);

  return (
    <div className="space-y-4">
      <AddEntity onAdd={onAddEntity} />

      {entities.length > 0 && (
        <section className="rounded-lg border border-rule bg-raised p-4">
          <h4 className="mb-3 text-sm font-medium">People, organisations and places</h4>
          <ul className="space-y-2">
            {entities.map((entity) => {
              const node = graph.nodes.find(
                (candidate) => candidate.kind === "entity" && candidate.id === entity.id,
              );
              const degree = node ? neighboursOf(graph, node).length : 0;
              return (
                <li key={entity.id} className="rounded border border-rule bg-paper p-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{entity.display_name}</span>
                    <span className="text-xs text-muted">
                      {entity.kind}
                      {entity.role_in_case ? ` — ${entity.role_in_case}` : ""}
                    </span>
                  </div>
                  {entity.aliases.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted">also: {entity.aliases.join(", ")}</p>
                  )}
                  {entity.sensitive && (
                    /* Section 18. Flagged on the row so nothing downstream has
                       to infer it, and shown so nobody publishes by accident. */
                    <p className="mt-0.5 text-xs text-muted">
                      Marked sensitive. Handle under the case’s privacy rules.
                    </p>
                  )}
                  {/* A count of connections, deliberately not a ranking. */}
                  <p className="mt-1 text-xs text-muted">
                    {degree === 0
                      ? "Nothing connects to this yet."
                      : `${degree} ${degree === 1 ? "connection" : "connections"}.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemoveEntity(entity.id)}
                    className="mt-1 text-xs text-muted underline hover:text-ink"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <AddEdge graph={graph} sources={sources} onAdd={onAddEdge} />
      <Edges graph={graph} onRemove={onRemoveEdge} />
      <Connection graph={graph} />

      {(loose.length > 0 || unsourced.length > 0) && (
        <section className="rounded-lg border border-rule bg-raised p-4">
          <h4 className="mb-2 text-sm font-medium">What the graph says about itself</h4>
          {loose.length > 0 && (
            <p className="text-sm text-muted">
              {loose.map((node) => node.label).join(", ")}{" "}
              {loose.length === 1 ? "is" : "are"} in the case and connected to nothing. That is
              either somebody nobody has worked on yet or somebody who does not belong here.
            </p>
          )}
          {unsourced.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              {unsourced.length} {unsourced.length === 1 ? "relationship has" : "relationships have"}{" "}
              nothing establishing {unsourced.length === 1 ? "it" : "them"}. Every one is a line a
              reader will take for a connection.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Edges({ graph, onRemove }: { graph: Graph; onRemove: (id: string) => void }) {
  if (graph.edges.length === 0) return null;
  const label = (ref: { kind: string; id: string }) =>
    graph.nodes.find((node) => nodeKey(node) === nodeKey(ref as GraphNode))?.label ?? "unknown";

  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <h4 className="mb-3 text-sm font-medium">Relationships</h4>
      <ul className="space-y-2">
        {graph.edges.map((edge) => (
          <li key={edge.id} className="rounded border border-rule bg-paper p-2">
            <p className="text-sm">
              {label(edge.from)}{" "}
              <span className="text-muted">{edge.relation.replace(/_/g, " ")}</span>{" "}
              {label(edge.to)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {edge.status.replace(/_/g, " ")}
              {edge.establishedBy ? "" : `, with nothing establishing it`}
              {edge.note ? ` — ${edge.note}` : ""}
            </p>
            <button
              type="button"
              onClick={() => onRemove(edge.id)}
              className="mt-1 text-xs text-muted underline hover:text-ink"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Connection({ graph }: { graph: Graph }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const paths = useMemo(() => {
    if (from === "" || to === "" || from === to) return null;
    const start = graph.nodes.find((node) => nodeKey(node) === from);
    const finish = graph.nodes.find((node) => nodeKey(node) === to);
    if (!start || !finish) return null;
    return pathsBetween(graph, start, finish);
  }, [graph, from, to]);

  if (graph.nodes.length < 2) return null;

  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <h4 className="mb-3 text-sm font-medium">How are these connected?</h4>
      {/* "Start at" and "End at" rather than "From" and "To", which the
          relationship form above already uses. Two controls with the same
          accessible name on one page are two controls a screen reader cannot
          tell apart, and the component test found it before anybody had to. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <NodePick id="path-from" label="Start at" value={from} onChange={setFrom} nodes={graph.nodes} />
        <NodePick id="path-to" label="End at" value={to} onChange={setTo} nodes={graph.nodes} />
      </div>

      {paths !== null && paths.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          Nothing in the case file connects them within four steps. That is a fact about the record,
          not about the people.
        </p>
      )}

      {paths !== null && paths.length > 0 && (
        <ol className="mt-3 space-y-3">
          {paths.map((path, index) => (
            <li key={index}>
              <p className="text-sm">
                {path.from.label}
                {path.steps.map((step) => (
                  <span key={step.edge.id}>
                    {" "}
                    <span className="text-muted">{step.edge.relation.replace(/_/g, " ")}</span>{" "}
                    {step.to.label}
                  </span>
                ))}
              </p>
              {/* The reading, always. The picture without it is the failure. */}
              <p className="mt-0.5 text-xs text-muted">{readPath(path)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function NodePick({
  id,
  label,
  value,
  onChange,
  nodes,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  nodes: readonly GraphNode[];
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
        <option value="">Choose</option>
        {nodes.map((node) => (
          <option key={nodeKey(node)} value={nodeKey(node)}>
            {node.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function AddEntity({
  onAdd,
}: {
  onAdd: (input: {
    kind: EntityRow["kind"];
    displayName: string;
    aliases: string[];
    roleInCase: string;
    sensitive: boolean;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<EntityRow["kind"]>("person");
  const [displayName, setDisplayName] = useState("");
  const [aliases, setAliases] = useState("");
  const [roleInCase, setRoleInCase] = useState("");
  const [sensitive, setSensitive] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (displayName.trim() === "") return;
    onAdd({
      kind,
      displayName,
      aliases: aliases.split(",").map((alias) => alias.trim()).filter(Boolean),
      roleInCase,
      sensitive,
    });
    setDisplayName("");
    setAliases("");
    setRoleInCase("");
    setSensitive(false);
    setOpen(false);
  }

  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">The case graph</h4>
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          className="rounded-lg border border-rule px-3 py-1.5 text-xs hover:border-accent"
        >
          {open ? "Close" : "Add a person or place"}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-3">
          <label htmlFor="entity-kind" className="mb-1 block text-xs text-muted">
            What is it?
          </label>
          <select
            id="entity-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as EntityRow["kind"])}
            className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {ENTITY_KINDS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>

          <label htmlFor="entity-name" className="mb-1 block text-xs text-muted">
            Name
          </label>
          <input
            id="entity-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />

          <label htmlFor="entity-aliases" className="mb-1 block text-xs text-muted">
            Other spellings, comma separated
          </label>
          <input
            id="entity-aliases"
            value={aliases}
            aria-describedby="entity-aliases-why"
            onChange={(event) => setAliases(event.target.value)}
            className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <p id="entity-aliases-why" className="mb-3 mt-1 text-xs text-muted">
            The commonest reason two records about one person never meet is that one calls her Nomsa
            and the other N. Dlamini.
          </p>

          <label htmlFor="entity-role" className="mb-1 block text-xs text-muted">
            Role in the case
          </label>
          <input
            id="entity-role"
            value={roleInCase}
            placeholder="witness, official, subject…"
            onChange={(event) => setRoleInCase(event.target.value)}
            className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />

          <label className="mb-3 flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={sensitive}
              onChange={(event) => setSensitive(event.target.checked)}
            />
            A minor, or a record holding sensitive personal data
          </label>

          <button
            type="submit"
            disabled={displayName.trim() === ""}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            Add
          </button>
        </form>
      )}
    </section>
  );
}

function AddEdge({
  graph,
  sources,
  onAdd,
}: {
  graph: Graph;
  sources: readonly SourceRow[];
  onAdd: (input: {
    relation: string;
    from: { kind: string; id: string };
    to: { kind: string; id: string };
    status: EpistemicStatus;
    establishedBy: string | null;
    note: string;
  }) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [relation, setRelation] = useState<string>("knows");
  const [status, setStatus] = useState<EpistemicStatus>("unknown");
  const [establishedBy, setEstablishedBy] = useState("");
  const [note, setNote] = useState("");

  if (graph.nodes.length < 2) return null;

  // The rule the schema enforces, said before the submit rather than after.
  const factWithoutSource = status === "fact" && establishedBy === "";
  const ready = from !== "" && to !== "" && from !== to && !factWithoutSource;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    const [fromKind, fromId] = from.split(":");
    const [toKind, toId] = to.split(":");
    onAdd({
      relation,
      from: { kind: fromKind!, id: fromId! },
      to: { kind: toKind!, id: toId! },
      status,
      establishedBy: establishedBy === "" ? null : establishedBy,
      note,
    });
    setFrom("");
    setTo("");
    setNote("");
  }

  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <h4 className="mb-3 text-sm font-medium">Record a relationship</h4>
      <form onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-3">
          <NodePick id="edge-from" label="From" value={from} onChange={setFrom} nodes={graph.nodes} />
          <div>
            <label htmlFor="edge-relation" className="mb-1 block text-xs text-muted">
              Relation
            </label>
            <select
              id="edge-relation"
              value={relation}
              onChange={(event) => setRelation(event.target.value)}
              className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {RELATIONS.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <NodePick id="edge-to" label="To" value={to} onChange={setTo} nodes={graph.nodes} />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="edge-status" className="mb-1 block text-xs text-muted">
              What is this, epistemically?
            </label>
            <select
              id="edge-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as EpistemicStatus)}
              className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {EPISTEMIC_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edge-source" className="mb-1 block text-xs text-muted">
              What establishes it?
            </label>
            <select
              id="edge-source"
              value={establishedBy}
              onChange={(event) => setEstablishedBy(event.target.value)}
              className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">Nothing yet</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <input
          value={note}
          aria-label="A note about this relationship"
          placeholder="A note, if it needs one"
          onChange={(event) => setNote(event.target.value)}
          className={cn(
            "mt-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none",
            "focus:border-accent",
          )}
        />

        {factWithoutSource && (
          <p className="mt-2 text-sm text-muted" role="status">
            An edge asserted as fact has to name what establishes it. Choose a source, or record it
            as an inference and say so.
          </p>
        )}

        <button
          type="submit"
          disabled={!ready}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
        >
          Record it
        </button>
      </form>
    </section>
  );
}
