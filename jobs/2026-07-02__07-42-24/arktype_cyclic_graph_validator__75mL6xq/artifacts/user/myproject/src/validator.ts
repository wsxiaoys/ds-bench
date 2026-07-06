import { scope } from "arktype";

// Define the self-referential scope for Node and Graph
export const types = scope({
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

export type Node = typeof types.Node.infer;
export type Graph = typeof types.Graph.infer;

// Attach the narrow predicate to Graph to express cross-node integrity constraints
export const graphType = types.Graph.narrow((g, ctx) => {
    const nodeIds = new Set<number>();
    
    // 1. All nodes[*].id values are unique
    for (const node of g.nodes) {
        if (nodeIds.has(node.id)) {
            return ctx.reject(`a Graph with unique node IDs (duplicate ID: ${node.id})`);
        }
        nodeIds.add(node.id);
    }
    
    // 3. rootId exists in nodes
    if (!nodeIds.has(g.rootId)) {
        return ctx.reject(`a Graph whose rootId (${g.rootId}) exists in nodes`);
    }
    
    // 2. Every edge target's id exists in nodes
    for (const node of g.nodes) {
        for (const edge of node.edges) {
            if (!nodeIds.has(edge.id)) {
                return ctx.reject(
                    `a Graph where all edge targets exist in nodes (node ${node.id} has invalid edge to ${edge.id})`
                );
            }
        }
    }
    
    return true;
});

/**
 * Validates a directed graph using ArkType and cross-node structural integrity constraints.
 * Throws an error with a descriptive message on invalid input.
 */
export function validateGraph(input: unknown): Graph {
    return graphType.assert(input);
}
