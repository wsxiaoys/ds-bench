import { scope, type } from "arktype";

const graphScope = scope({
    Node: {
        id: "number.integer >= 0",
        label: "string >= 1 <= 40",
        edges: "Node[]"
    },
    GraphBase: {
        rootId: "number.integer >= 0",
        nodes: "Node[] >= 1 <= 1000"
    }
});

const types = graphScope.export();

export const Graph = types.GraphBase.narrow((g, ctx) => {
    const nodeIds = new Set<number>();
    
    // Check for unique ids
    for (const node of g.nodes) {
        if (nodeIds.has(node.id)) {
            return ctx.mustBe("a graph with unique node ids");
        }
        nodeIds.add(node.id);
    }
    
    // Check rootId exists
    if (!nodeIds.has(g.rootId)) {
        return ctx.mustBe("a graph where rootId exists in nodes");
    }
    
    // Helper to recursively check all edges
    function checkEdges(nodes: typeof g.nodes): boolean {
        for (const node of nodes) {
            for (const edge of node.edges) {
                if (!nodeIds.has(edge.id)) {
                    return false;
                }
                if (!checkEdges([edge])) {
                    return false;
                }
            }
        }
        return true;
    }
    
    if (!checkEdges(g.nodes)) {
        return ctx.mustBe("a graph where all edge targets exist in nodes");
    }
    
    return true;
});

export function validateGraph(input: unknown) {
    const out = Graph(input);
    if (out instanceof type.errors) {
        throw new Error(out.summary);
    }
    return out;
}
