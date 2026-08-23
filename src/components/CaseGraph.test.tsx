// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Graph, GraphEdge, GraphNode } from "@shared/detective/graph.ts";
import type { EpistemicStatus } from "@shared/detective/epistemic.ts";
import type { EntityRow, SourceRow } from "@/lib/detective-api.ts";
import { CaseGraph } from "./CaseGraph.tsx";

const SOURCES: SourceRow[] = [
  { id: "src1", kind: "official_record", title: "Gate log", retrieved_from: "https://e.org/a", retrieved_at: "2026-08-01", content_hash: null, reference: 1 },
];

const ENTITIES: EntityRow[] = [
  { id: "amy", kind: "person", display_name: "Amy Dlamini", aliases: ["A. Dlamini"], role_in_case: "witness", description: null, sensitive: false },
  { id: "ben", kind: "person", display_name: "Ben Cole", aliases: [], role_in_case: null, description: null, sensitive: false },
  { id: "depot", kind: "location", display_name: "The depot", aliases: [], role_in_case: null, description: null, sensitive: false },
];

const node = (id: string, label: string): GraphNode => ({ kind: "entity", id, label });

let n = 0;
const edge = (
  from: string, to: string, relation: string,
  status: EpistemicStatus = "fact", establishedBy: string | null = "src1",
): GraphEdge => ({
  id: `e${(n += 1)}`,
  relation,
  from: { kind: "entity", id: from },
  to: { kind: "entity", id: to },
  status,
  establishedBy,
  note: null,
});

const NODES = [node("amy", "Amy Dlamini"), node("ben", "Ben Cole"), node("depot", "The depot")];

function draw(graph: Graph, over: Partial<Parameters<typeof CaseGraph>[0]> = {}) {
  return render(
    <CaseGraph
      graph={graph}
      entities={ENTITIES}
      sources={SOURCES}
      onAddEntity={vi.fn()}
      onRemoveEntity={vi.fn()}
      onAddEdge={vi.fn()}
      onRemoveEdge={vi.fn()}
      {...over}
    />,
  );
}

describe("the nodes", () => {
  it("shows an alias, which is how two records about one person meet", () => {
    draw({ nodes: NODES, edges: [] });
    expect(screen.getByText("also: A. Dlamini")).toBeInTheDocument();
  });

  it("counts connections without ranking anybody", () => {
    draw({ nodes: NODES, edges: [edge("amy", "ben", "knows")] });
    expect(screen.getAllByText("1 connection.")).toHaveLength(2);
    expect(screen.getByText("Nothing connects to this yet.")).toBeInTheDocument();
    expect(screen.queryByText(/most connected|central|rank/i)).not.toBeInTheDocument();
  });

  // Section 18. Shown so nobody publishes by accident.
  it("marks a sensitive record on screen", () => {
    draw({ nodes: NODES, edges: [] }, {
      entities: [{ ...ENTITIES[0]!, sensitive: true }],
    });
    expect(screen.getByText(/Marked sensitive/)).toBeInTheDocument();
  });
});

// The rule the schema enforces, said before the submit rather than after.
describe("an edge asserted as fact must name what establishes it", () => {
  it("refuses to record one, and says what to do instead", async () => {
    const onAddEdge = vi.fn();
    draw({ nodes: NODES, edges: [] }, { onAddEdge });

    await userEvent.selectOptions(screen.getByLabelText("From"), "entity:amy");
    await userEvent.selectOptions(screen.getByLabelText("To"), "entity:ben");
    await userEvent.selectOptions(screen.getByLabelText(/What is this, epistemically/), "fact");

    expect(screen.getByRole("button", { name: "Record it" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/record it as an inference and say so/);

    await userEvent.selectOptions(screen.getByLabelText(/What establishes it/), "src1");
    expect(screen.getByRole("button", { name: "Record it" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Record it" }));
    expect(onAddEdge).toHaveBeenCalledWith(
      expect.objectContaining({ status: "fact", establishedBy: "src1" }),
    );
  });

  it("lets an inference stand unsourced", async () => {
    const onAddEdge = vi.fn();
    draw({ nodes: NODES, edges: [] }, { onAddEdge });
    await userEvent.selectOptions(screen.getByLabelText("From"), "entity:amy");
    await userEvent.selectOptions(screen.getByLabelText("To"), "entity:ben");
    await userEvent.selectOptions(screen.getByLabelText(/What is this, epistemically/), "inference");
    await userEvent.click(screen.getByRole("button", { name: "Record it" }));
    expect(onAddEdge).toHaveBeenCalledWith(
      expect.objectContaining({ status: "inference", establishedBy: null }),
    );
  });
});

// A chain of three unverified links looks exactly like a chain of three
// established ones once it is drawn.
describe("how strong a connection is", () => {
  async function ask(graph: Graph) {
    draw(graph);
    await userEvent.selectOptions(screen.getByLabelText("Start at"), "entity:amy");
    await userEvent.selectOptions(screen.getByLabelText("End at"), "entity:depot");
  }

  it("says when every link is established", async () => {
    await ask({ nodes: NODES, edges: [edge("amy", "ben", "knows"), edge("ben", "depot", "visited")] });
    expect(screen.getByText(/every link established by a source/)).toBeInTheDocument();
  });

  it("names the weakest link rather than showing the line alone", async () => {
    await ask({
      nodes: NODES,
      edges: [edge("amy", "ben", "knows"), edge("ben", "depot", "visited", "unverified", null)],
    });
    expect(screen.getByText(/The weakest link is "visited" to The depot, which is unverified/))
      .toBeInTheDocument();
  });

  it("refuses to call a path through a contradicted link a connection", async () => {
    await ask({
      nodes: NODES,
      edges: [edge("amy", "ben", "knows"), edge("ben", "depot", "visited", "contradicted", null)],
    });
    expect(screen.getByText(/It does not connect them/)).toBeInTheDocument();
  });

  it("says plainly when nothing connects them", async () => {
    await ask({ nodes: NODES, edges: [] });
    expect(screen.getByText(/a fact about the record, not about the people/)).toBeInTheDocument();
  });
});

describe("what the graph says about itself", () => {
  it("names what nothing connects to", () => {
    draw({ nodes: NODES, edges: [edge("amy", "ben", "knows")] });
    expect(screen.getByText(/somebody who does not belong here/)).toBeInTheDocument();
  });

  // Every one is a line a reader will take for a connection.
  it("counts the relationships nothing establishes", () => {
    draw({ nodes: NODES, edges: [edge("amy", "ben", "knows", "inference", null)] });
    expect(screen.getByText(/1 relationship has nothing establishing it/)).toBeInTheDocument();
  });

  it("says nothing when every relationship is sourced and everything connects", () => {
    draw({ nodes: NODES, edges: [edge("amy", "ben", "knows"), edge("ben", "depot", "visited")] });
    expect(screen.queryByRole("heading", { name: "What the graph says about itself" }))
      .not.toBeInTheDocument();
  });
});
