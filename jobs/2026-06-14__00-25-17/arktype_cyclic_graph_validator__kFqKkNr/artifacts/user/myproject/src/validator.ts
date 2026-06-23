import { scope } from "arktype";

const graphScope = scope({
  Node: {
    id: "number>=0",
    label: "string>=1&string<=40",
    edges: "Node[]",
  },
  Graph: {
    rootId: "number>=0",
    nodes: "Node[]>=1&Node[]<=1000",
  },
});

const { Node, Graph } = graphScope.export();

// Recursively collect all edge target IDs at every nesting level
function collectEdgeIds(edges: { id: number; edges: unknown[] }[]): number[] {
  const ids: number[] = [];
  for (const edge of edges) {
    ids.push(edge.id);
    if (edge.edges && Array.isArray(edge.edges)) {
      ids.push(...collectEdgeIds(edge.edges as { id: number; edges: unknown[] }[]));
    }
  }
  return ids;
}

const ValidatedGraph = Graph.narrow((g, ctx) => {
  // Constraint 1: All node ids must be unique
  const ids = g.nodes.map((n: { id: number }) => n.id);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) {
    return ctx.mustBe("have unique node ids");
  }

  // Constraint 2: rootId must exist in nodes
  if (!idSet.has(g.rootId)) {
    return ctx.mustBe("have rootId that exists in nodes");
  }

  // Constraint 3: Every edge target id must exist in nodes (recursively)
  for (const node of g.nodes) {
    const allEdgeIds = collectEdgeIds(node.edges);
    for (const edgeId of allEdgeIds) {
      if (!idSet.has(edgeId)) {
        return ctx.mustBe("have all edge targets exist in nodes");
      }
    }
  }

  return true;
});

export type Graph = typeof ValidatedGraph.infer;

export function validateGraph(input: unknown): Graph {
  return ValidatedGraph.assert(input);
}