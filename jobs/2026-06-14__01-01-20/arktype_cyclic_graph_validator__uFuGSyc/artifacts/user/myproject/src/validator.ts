import { scope, ArkErrors } from "arktype";

// Define the Node and Graph types using scope() to support self-reference.
// Node has edges that reference other Nodes, which requires a scope.
const graphScope = scope({
  Node: {
    id: "number >= 0",
    label: "1 <= string <= 40",
    edges: "Node[]",
  },
  Graph: {
    rootId: "number >= 0",
    nodes: "1 <= Node[] <= 1000",
  },
}).export();

// Extract the types from the exported scope
const GraphType = graphScope.Graph;

// Attach cross-node structural constraints via .narrow() on the Graph type:
// 1. All node ids must be unique
// 2. Every edge target id must exist in nodes
// 3. rootId must exist in nodes
const ValidatedGraph = GraphType.narrow((graph, ctx) => {
  const nodes = graph.nodes;
  const ids = new Set<number>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    // Check for duplicate ids
    if (ids.has(node.id)) {
      return ctx.reject({
        expected: "unique node ids",
        actual: `duplicate id ${node.id}`,
      });
    }
    ids.add(node.id);
  }

  // Check that every edge target exists in nodes
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    for (let j = 0; j < node.edges.length; j++) {
      const edge = node.edges[j];
      if (!ids.has(edge.id)) {
        return ctx.reject({
          expected: "edge target id exists in nodes",
          actual: `edge target id ${edge.id} not found in nodes`,
        });
      }
    }
  }

  // Check that rootId exists in nodes
  if (!ids.has(graph.rootId)) {
    return ctx.reject({
      expected: "rootId exists in nodes",
      actual: `rootId ${graph.rootId} not found in nodes`,
    });
  }

  return true;
});

export function validateGraph(input: unknown) {
  const result = ValidatedGraph(input);
  if (result instanceof ArkErrors) {
    throw result;
  }
  return result;
}
