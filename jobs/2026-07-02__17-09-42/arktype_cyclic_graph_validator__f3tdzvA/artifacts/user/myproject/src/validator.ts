import { ArkErrors, scope } from "arktype";

/**
 * Infer the output type from an arktype `Type` value.
 *
 * The `.infer` member on a `Type` is an inference-only marker (it is
 * `undefined` at runtime), so we cannot simply do `typeof Node.infer`.
 * We instead pull the declared type out of the Type via indexed access.
 */
type InferOf<T> = T extends { readonly infer: infer U } ? U : never;

/**
 * `Node` schema:
 *   id:    non-negative integer
 *   label: string of length 1..40 (inclusive)
 *   edges: array of `Node` (self-referential; supports cycles)
 *
 * `Graph` schema:
 *   rootId: non-negative integer
 *   nodes:  array of 1..1000 `Node`s
 *
 * Cross-node structural constraints are encoded as a `.narrow(...)` predicate
 * attached to the `Graph` type:
 *   1. all `nodes[*].id` values are unique;
 *   2. every edge target's `id` exists in `nodes`;
 *   3. `rootId` is one of `nodes[*].id`.
 *
 * `Node` is defined inside `scope({...}).export()` so that `Node[]` can
 * refer to the alias within its own scope (a single inline `type({...})`
 * cannot express the self-referential cycle).
 */
const graphModule = scope({
	Node: {
		id: "number >= 0",
		label: "1 <= string <= 40",
		edges: "Node[]"
	}
}).export();

/**
 * Build the `Graph` type against the same scope as `Node` and attach the
 * cross-node structural integrity constraints as a `.narrow(...)` predicate.
 *
 * The scope is reachable from the exported `Node` type as `Node.$.type(...)`.
 */
const Graph = graphModule.Node.$.type({
	rootId: "number >= 0",
	nodes: "1 <= Node[] <= 1000"
}).narrow((value, ctx) => {
	const seenIds = new Set<number>();
	for (const node of value.nodes) {
		if (seenIds.has(node.id)) {
			return ctx.mustBe("node ids must be unique");
		}
		seenIds.add(node.id);
	}
	if (!seenIds.has(value.rootId)) {
		return ctx.mustBe("rootId must match a node id");
	}
	for (const node of value.nodes) {
		for (const edge of node.edges) {
			if (!seenIds.has(edge.id)) {
				return ctx.mustBe("edge target must be a node id");
			}
		}
	}
	return true;
});

export type Node = InferOf<typeof graphModule.Node>;
export type Graph = InferOf<typeof Graph>;

/**
 * Validate that `input` is a structurally well-formed `Graph`.
 *
 * @throws {Error} when `input` does not satisfy the schema.
 * @returns the validated `Graph` on success.
 */
export function validateGraph(input: unknown): Graph {
	const result = Graph(input);
	if (result instanceof ArkErrors) {
		throw new Error(result.summary);
	}
	return result;
}
