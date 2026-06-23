import { scope } from "arktype";

// Define the schema using scope and export
const types = scope({
  Node: {
    id: "number % 1 >= 0",
    label: "1 <= string <= 40",
    edges: "Node[]"
  },
  Graph: {
    rootId: "number % 1 >= 0",
    nodes: "1 <= Node[] <= 1000"
  }
}).export();

// Extract TypeScript types from the exported scope if needed
export type Node = typeof types.Node.infer;
export type Graph = typeof types.Graph.infer;

// Attach the narrow predicate to the Graph type
export const GraphSchema = types.Graph.narrow((g, ctx) => {
  const ids = new Set<number>();
  for (const node of g.nodes) {
    if (ids.has(node.id)) {
      ctx.error({ code: "predicate", problem: `duplicate node id: ${node.id}` });
      return false;
    }
    ids.add(node.id);
  }

  for (const node of g.nodes) {
    for (const edge of node.edges) {
      if (!ids.has(edge.id)) {
        ctx.error({ code: "predicate", problem: `edge target id ${edge.id} does not exist in nodes` });
        return false;
      }
    }
  }

  if (!ids.has(g.rootId)) {
    ctx.error({ code: "predicate", problem: `rootId ${g.rootId} does not exist in nodes` });
    return false;
  }

  return true;
});

/**
 * Validates a directed graph.
 * Returns the validated Graph or throws on invalid input.
 */
export function validateGraph(input: unknown): Graph {
  return GraphSchema.assert(input);
}
