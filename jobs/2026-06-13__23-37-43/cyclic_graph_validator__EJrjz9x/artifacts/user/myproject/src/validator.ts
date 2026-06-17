import { scope, ArkErrors } from "arktype";

// ─── Schema definition ────────────────────────────────────────────────────────
// We use scope() so that "Node" can reference itself (self-referential / cyclic).
// The Graph type is exported from the scope, then augmented with narrow predicates.

const graphScope = scope({
  Node: {
    // non-negative integer
    id: "number.integer >= 0",
    // string, length 1..40
    label: "1 <= string <= 40",
    // array of Node (self-referential – only expressible via scope)
    edges: "Node[]",
  },
  Graph: {
    rootId: "number.integer >= 0",
    // 1..1000 nodes
    nodes: "1 <= Node[] <= 1000",
  },
}).export();

// ─── Attach cross-node structural constraints via narrow predicates ─────────
// These cannot be expressed in the structural schema, so they live here.
const GraphType = graphScope.Graph.narrow((g, ctx) => {
  const nodeIds = new Set(g.nodes.map((n) => n.id));

  // 1. All node ids must be unique
  if (nodeIds.size !== g.nodes.length) {
    return ctx.mustBe("a graph whose node ids are all unique");
  }

  // 2. Every edge target id must exist among the graph's nodes
  for (const node of g.nodes) {
    for (const edge of node.edges) {
      if (!nodeIds.has(edge.id)) {
        return ctx.mustBe(
          `a graph where all edge targets exist in nodes (edge id ${edge.id} not found)`
        );
      }
    }
  }

  // 3. rootId must be present in nodes
  if (!nodeIds.has(g.rootId)) {
    return ctx.mustBe(
      `a graph whose rootId (${g.rootId}) exists in nodes`
    );
  }

  return true;
});

// ─── Exported types ───────────────────────────────────────────────────────────
export type Node = typeof graphScope.Node.infer;
export type Graph = typeof graphScope.Graph.infer;

// ─── Validator function ───────────────────────────────────────────────────────
/**
 * Validates the given unknown value as a Graph.
 * Returns the validated Graph on success, or throws on invalid input.
 */
export function validateGraph(input: unknown): Graph {
  const result = GraphType(input);
  if (result instanceof ArkErrors) {
    throw result;
  }
  return result as Graph;
}

export { graphScope, GraphType };
