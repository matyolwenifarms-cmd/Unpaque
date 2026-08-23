import { describe, expect, it } from "vitest";
import {
  neighboursOf,
  nodeKey,
  pathsBetween,
  readPath,
  unconnected,
  unsourcedEdges,
  weaker,
  type Graph,
  type GraphEdge,
  type GraphNode,
} from "./graph.ts";
import type { EpistemicStatus } from "./epistemic.ts";

const person = (id: string, label: string): GraphNode => ({ kind: "entity", id, label, entityKind: "person" });
const place = (id: string, label: string): GraphNode => ({ kind: "entity", id, label, entityKind: "location" });

let n = 0;
const edge = (
  from: GraphNode,
  to: GraphNode,
  relation: string,
  status: EpistemicStatus = "fact",
  establishedBy: string | null = "src-1",
): GraphEdge => ({
  id: `e${(n += 1)}`,
  relation,
  from: { kind: from.kind, id: from.id },
  to: { kind: to.kind, id: to.id },
  status,
  establishedBy,
});

const AMY = person("amy", "Amy");
const BEN = person("ben", "Ben");
const CLEO = person("cleo", "Cleo");
const DEPOT = place("depot", "The depot");

describe("moving through the graph", () => {
  // A directed edge records who did the contacting, which matters when it is
  // read. It does not mean the connection is invisible from the other end.
  it("finds a neighbour from either end of a directed edge", () => {
    const graph: Graph = { nodes: [AMY, BEN], edges: [edge(AMY, BEN, "contacted")] };
    expect(neighboursOf(graph, AMY).map((found) => found.node.id)).toEqual(["ben"]);
    expect(neighboursOf(graph, BEN).map((found) => found.node.id)).toEqual(["amy"]);
  });

  it("ignores an edge that touches neither end", () => {
    const graph: Graph = { nodes: [AMY, BEN, CLEO], edges: [edge(BEN, CLEO, "knows")] };
    expect(neighboursOf(graph, AMY)).toEqual([]);
  });

  it("distinguishes nodes of different kinds with the same id", () => {
    expect(nodeKey({ kind: "entity", id: "x" })).not.toBe(nodeKey({ kind: "claim", id: "x" }));
  });
});

describe("how two things are connected", () => {
  it("finds the direct path", () => {
    const graph: Graph = { nodes: [AMY, BEN], edges: [edge(AMY, BEN, "contacted")] };
    const paths = pathsBetween(graph, AMY, BEN);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.steps).toHaveLength(1);
  });

  it("finds a path through an intermediate", () => {
    const graph: Graph = {
      nodes: [AMY, BEN, CLEO],
      edges: [edge(AMY, BEN, "knows"), edge(BEN, CLEO, "works_for")],
    };
    const paths = pathsBetween(graph, AMY, CLEO);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.steps.map((step) => step.to.id)).toEqual(["ben", "cleo"]);
  });

  it("returns the shorter path first", () => {
    const graph: Graph = {
      nodes: [AMY, BEN, CLEO, DEPOT],
      edges: [
        edge(AMY, DEPOT, "visited"),
        edge(AMY, BEN, "knows"),
        edge(BEN, CLEO, "knows"),
        edge(CLEO, DEPOT, "visited"),
      ],
    };
    const paths = pathsBetween(graph, AMY, DEPOT);
    expect(paths.length).toBeGreaterThan(1);
    expect(paths[0]!.steps).toHaveLength(1);
  });

  it("never walks the same node twice", () => {
    const graph: Graph = {
      nodes: [AMY, BEN, CLEO],
      edges: [edge(AMY, BEN, "knows"), edge(BEN, CLEO, "knows"), edge(CLEO, AMY, "knows")],
    };
    for (const path of pathsBetween(graph, AMY, CLEO)) {
      const visited = path.steps.map((step) => step.to.id);
      expect(new Set(visited).size).toBe(visited.length);
    }
  });

  // Beyond a few steps everything in a case connects to everything else, and a
  // screen of six-step paths is the graph telling you it is a graph.
  it("stops at the depth given", () => {
    const chain = ["a", "b", "c", "d", "e", "f"].map((id) => person(id, id.toUpperCase()));
    const graph: Graph = {
      nodes: chain,
      edges: chain.slice(0, -1).map((node, index) => edge(node, chain[index + 1]!, "knows")),
    };
    expect(pathsBetween(graph, chain[0]!, chain[5]!, 3)).toHaveLength(0);
    expect(pathsBetween(graph, chain[0]!, chain[5]!, 5)).toHaveLength(1);
  });

  it("finds nothing between a node and itself, or a node not in the graph", () => {
    const graph: Graph = { nodes: [AMY, BEN], edges: [edge(AMY, BEN, "knows")] };
    expect(pathsBetween(graph, AMY, AMY)).toEqual([]);
    expect(pathsBetween(graph, AMY, { kind: "entity", id: "nobody" })).toEqual([]);
  });
});

// The whole reason the module exists. A chain of three unverified links looks
// exactly like a chain of three established ones once it is drawn.
describe("a path is only as strong as its weakest link", () => {
  it("takes the weakest status along the path", () => {
    const graph: Graph = {
      nodes: [AMY, BEN, CLEO],
      edges: [
        edge(AMY, BEN, "knows", "fact"),
        edge(BEN, CLEO, "works_for", "inference", null),
      ],
    };
    expect(pathsBetween(graph, AMY, CLEO)[0]!.weakest).toBe("inference");
  });

  it("orders a contradicted link below everything else", () => {
    expect(weaker("contradicted", "unverified")).toBe("contradicted");
    expect(weaker("fact", "corroborated")).toBe("corroborated");
    expect(weaker("claim", "inference")).toBe("inference");
  });

  it("says so when every link is established", () => {
    const graph: Graph = { nodes: [AMY, BEN], edges: [edge(AMY, BEN, "contacted", "fact")] };
    expect(readPath(pathsBetween(graph, AMY, BEN)[0]!))
      .toBe("Connected in 1 step, every link established by a source.");
  });

  // A path through a contradicted link is not a connection, and saying it is
  // "weak" would leave a reader thinking it is a weak connection.
  it("refuses to call a path through a contradicted link a connection", () => {
    const graph: Graph = {
      nodes: [AMY, BEN, CLEO],
      edges: [edge(AMY, BEN, "knows", "fact"), edge(BEN, CLEO, "knows", "contradicted", null)],
    };
    const reading = readPath(pathsBetween(graph, AMY, CLEO)[0]!);
    expect(reading).toMatch(/contradicted by the record/);
    expect(reading).toMatch(/It does not connect them/);
  });

  it("names the link that weakens the path, and where it goes", () => {
    const graph: Graph = {
      nodes: [AMY, BEN, CLEO],
      edges: [
        edge(AMY, BEN, "knows", "fact"),
        edge(BEN, CLEO, "works_for", "unverified", null),
      ],
    };
    const reading = readPath(pathsBetween(graph, AMY, CLEO)[0]!);
    expect(reading).toMatch(/The weakest link is "works_for" to Cleo, which is unverified/);
  });

  // No centrality, no most-connected, no score. A number beside a name in an
  // investigation is read as suspicion.
  it("scores nothing", () => {
    const graph: Graph = {
      nodes: [AMY, BEN, CLEO],
      edges: [edge(AMY, BEN, "knows"), edge(AMY, CLEO, "knows")],
    };
    const text = JSON.stringify(pathsBetween(graph, BEN, CLEO));
    expect(text).not.toMatch(/score|centrality|rank|weight|likelihood/i);
  });
});

describe("what the graph says about itself", () => {
  it("names a node nothing connects to", () => {
    const graph: Graph = { nodes: [AMY, BEN, CLEO], edges: [edge(AMY, BEN, "knows")] };
    expect(unconnected(graph).map((node) => node.id)).toEqual(["cleo"]);
  });

  it("names nothing when everything is connected", () => {
    const graph: Graph = { nodes: [AMY, BEN], edges: [edge(AMY, BEN, "knows")] };
    expect(unconnected(graph)).toEqual([]);
  });

  // Every one of these is a line somebody will read as a connection.
  it("counts the edges nothing establishes", () => {
    const graph: Graph = {
      nodes: [AMY, BEN, CLEO],
      edges: [edge(AMY, BEN, "knows", "fact"), edge(BEN, CLEO, "knows", "inference", null)],
    };
    expect(unsourcedEdges(graph).map((found) => found.id)).toEqual([graph.edges[1]!.id]);
  });
});
