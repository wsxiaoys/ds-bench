import { scope } from "arktype";

/**
 * Structural shape of a single graph node.
 *
 * `Node` is self-referential: its `edges` array points to other `Node`s,
 * which lets the graph contain cycles. This kind of recursive schema cannot
 * be expressed with a single inline `type({...})` call, so we define it inside
 * a `scope(...)` and pull the resolved types back out via `.export()`.
 */
export interface Node {
	id: number;
	label: string;
	edges: Node[];
}

/**
 * Structural shape of the top-level graph payload.
 */
export interface Graph {
	rootId: number;
	nodes: Node[];
}

const types = scope({
	Node: {
		id: "number.integer >= 0",
		label: "1 <= string <= 40",
		edges: "Node[]"
	},
	Graph: {
		rootId: "number.integer >= 0",
		nodes: "1 <= Node[] <= 1000"
	}
}).export();

/**
 * The `Graph` type with cross-node structural integrity constraints applied
 * via a `.narrow(...)` predicate. The shape rules (non-negative integer ids,
 * bounded label length, non-empty bounded node list, recursive edges) are
 * already enforced by the scope definition above; this predicate enforces the
 * constraints that span the whole graph and therefore cannot be expressed
 * structurally on a single node:
 *
 *   1. Every `nodes[*].id` is unique.
 *   2. Every edge target's `id` resolves to a node that exists in `nodes`.
 *   3. The declared `rootId` exists as one of the `nodes[*].id` values.
 */
export const GraphType = types.Graph.narrow((g, ctx) => {
	const seenIds = new Set<number>();

	// Constraint 1: unique node ids (also builds the lookup for 2 & 3).
	for (const node of g.nodes) {
		if (seenIds.has(node.id)) {
			return ctx.mustBe(`unique node ids (duplicate id ${node.id})`);
		}
		seenIds.add(node.id);
	}

	// Constraint 3: the declared root id must reference an existing node.
	if (!seenIds.has(g.rootId)) {
		return ctx.mustBe(`rootId ${g.rootId} to exist in nodes`);
	}

	// Constraint 2: every edge target must point at an existing node id.
	for (const node of g.nodes) {
		for (const edge of node.edges) {
			if (!seenIds.has(edge.id)) {
				return ctx.mustBe(
					`edge target id ${edge.id} (from node ${node.id}) to exist in nodes`
				);
			}
		}
	}

	return true;
});

/**
 * Validate an unknown input as a {@link Graph}.
 *
 * @throws {import("arktype").ArkErrors} when the input does not satisfy the
 *         structural shape rules or the cross-node integrity constraints.
 * @returns the validated `Graph` (the same reference, narrowed to `Graph`).
 */
export function validateGraph(input: unknown): Graph {
	return GraphType.assert(input);
}