// The case graph, and how strong a connection through it actually is.
//
// Section 11. Nodes are people, organisations, locations, events, claims and
// sources; edges are the specification's relation verbs. The traversal below
// exists for one question — "how are these two connected?" — and the whole
// module is shaped by what goes wrong when that question is answered carelessly.
//
// **A path is only as strong as its weakest edge.** An edge carries an
// epistemic status because it is itself a claim (see the migration). A chain
// of three unverified links drawn on a screen looks exactly like a chain of
// three established ones, and the picture is how an investigation convinces
// itself: nobody re-reads the provenance of a line they can see. So a path
// carries the weakest status along it, and `Path` has no field for a strength
// that is not derived from its links.
//
// **Nothing here scores a connection.** No centrality, no "most connected
// person", no ranking. The same refusal as the hypothesis module: a number
// beside a name in an investigation is read as suspicion, and the arithmetic
// that produced it knows nothing about the case.

import type { EpistemicStatus } from "./epistemic.ts";

export const NODE_KINDS = ["entity", "event", "claim", "source"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export interface GraphNode {
  kind: NodeKind;
  id: string;
  label: string;
  /** For an entity: person, organisation or location. */
  entityKind?: "person" | "organisation" | "location";
  /** Section 18: a minor, or a record holding sensitive personal data. */
  sensitive?: boolean;
}

export interface GraphEdge {
  id: string;
  relation: string;
  from: { kind: NodeKind; id: string };
  to: { kind: NodeKind; id: string };
  status: EpistemicStatus;
  /** The source establishing it, where there is one. */
  establishedBy?: string | null;
  note?: string | null;
}

/** A node identity that can be compared and used as a map key. */
export function nodeKey(node: { kind: NodeKind; id: string }): string {
  return `${node.kind}:${node.id}`;
}

/**
 * How much weight a status can bear when a chain is only as strong as its
 * weakest link.
 *
 * Ordered, and the order is a claim about evidence rather than a preference.
 * `unknown` sits at the bottom with `unverified` because an unexamined link
 * and an examined-but-unconfirmed one are equally unable to carry a
 * conclusion; `contradicted` sits below both, because a link the record argues
 * against is worse than one it is silent about.
 */
const STRENGTH: Record<EpistemicStatus, number> = {
  contradicted: 0,
  disputed: 1,
  contested: 1,
  unresolved: 2,
  unknown: 2,
  unverified: 2,
  inference: 3,
  claim: 4,
  partially_corroborated: 5,
  corroborated: 6,
  fact: 7,
};

/** Whichever of two statuses can bear less weight. */
export function weaker(a: EpistemicStatus, b: EpistemicStatus): EpistemicStatus {
  return STRENGTH[a] <= STRENGTH[b] ? a : b;
}

export interface Step {
  edge: GraphEdge;
  /** The node this step arrives at. */
  to: GraphNode;
}

export interface Path {
  from: GraphNode;
  steps: Step[];
  /**
   * The weakest status on the path.
   *
   * Derived, always. There is no constructor that takes one, because a path
   * whose stated strength did not come from its own links is the exact thing
   * this module exists to prevent.
   */
  weakest: EpistemicStatus;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Every node an edge reaches from this one, in either direction. */
export function neighboursOf(graph: Graph, node: { kind: NodeKind; id: string }): Array<{
  edge: GraphEdge;
  node: GraphNode;
}> {
  const key = nodeKey(node);
  const byKey = new Map(graph.nodes.map((candidate) => [nodeKey(candidate), candidate]));
  const found: Array<{ edge: GraphEdge; node: GraphNode }> = [];

  for (const edge of graph.edges) {
    // Traversed in both directions whatever the verb. A directed edge records
    // who did the contacting, which matters when it is read; it does not mean
    // the connection is invisible from the other end, and treating it that way
    // hides half the graph from anybody who starts at the wrong node.
    const other = nodeKey(edge.from) === key ? edge.to : nodeKey(edge.to) === key ? edge.from : null;
    if (other === null) continue;
    const resolved = byKey.get(nodeKey(other));
    if (resolved) found.push({ edge, node: resolved });
  }
  return found;
}

export const DEFAULT_MAX_DEPTH = 4;

/**
 * Every path between two nodes, shortest first.
 *
 * Breadth-first and depth-capped. Beyond four steps almost everything in a
 * case is connected to almost everything else — through "was mentioned in
 * the same article", usually — and a screen full of six-step paths is not a
 * finding, it is the graph telling you it is a graph.
 */
export function pathsBetween(
  graph: Graph,
  from: { kind: NodeKind; id: string },
  to: { kind: NodeKind; id: string },
  maxDepth = DEFAULT_MAX_DEPTH,
): Path[] {
  const byKey = new Map(graph.nodes.map((node) => [nodeKey(node), node]));
  const start = byKey.get(nodeKey(from));
  const finish = byKey.get(nodeKey(to));
  if (!start || !finish || nodeKey(start) === nodeKey(finish)) return [];

  const found: Path[] = [];
  const queue: Array<{ node: GraphNode; steps: Step[]; seen: Set<string> }> = [
    { node: start, steps: [], seen: new Set([nodeKey(start)]) },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.steps.length >= maxDepth) continue;

    for (const { edge, node } of neighboursOf(graph, current.node)) {
      if (current.seen.has(nodeKey(node))) continue;
      const steps = [...current.steps, { edge, to: node }];
      if (nodeKey(node) === nodeKey(finish)) {
        found.push({
          from: start,
          steps,
          weakest: steps.map((step) => step.edge.status).reduce(weaker),
        });
        continue;
      }
      queue.push({ node, steps, seen: new Set([...current.seen, nodeKey(node)]) });
    }
  }

  return found;
}

/**
 * What a path may be said to show.
 *
 * A sentence rather than a boolean, because the useful thing is not "is this
 * connection established" but "what is the link that stops it being".
 */
export function readPath(path: Path): string {
  const links = path.steps.length;
  const hops = `${links} ${links === 1 ? "step" : "steps"}`;

  if (path.weakest === "fact") {
    return `Connected in ${hops}, every link established by a source.`;
  }
  if (path.weakest === "contradicted") {
    return `A path of ${hops} exists, but one of its links is contradicted by the record. It does not connect them.`;
  }

  const weakest = path.steps.find((step) => step.edge.status === path.weakest);
  const where = weakest
    ? ` The weakest link is "${weakest.edge.relation}" to ${weakest.to.label}, which is ${path.weakest.replace(/_/g, " ")}.`
    : "";
  return `A path of ${hops}, no stronger than its weakest link.${where}`;
}

/**
 * Nodes nothing connects to.
 *
 * A finding rather than a tidying-up problem. A person in a case file with no
 * relationship to anything is either somebody nobody has worked on yet or
 * somebody who does not belong in the case, and both are worth knowing.
 */
export function unconnected(graph: Graph): GraphNode[] {
  const touched = new Set<string>();
  for (const edge of graph.edges) {
    touched.add(nodeKey(edge.from));
    touched.add(nodeKey(edge.to));
  }
  return graph.nodes.filter((node) => !touched.has(nodeKey(node)));
}

/**
 * Edges asserted without anything establishing them.
 *
 * Every one of these is a line somebody will read as a connection. Counting
 * them is the graph's version of the dossier's unknowns section: not an error
 * list, a statement about how much of the picture is drawn from inference.
 */
export function unsourcedEdges(graph: Graph): GraphEdge[] {
  return graph.edges.filter((edge) => !edge.establishedBy);
}
