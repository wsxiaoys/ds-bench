# Cyclic Graph Validator (ArkType)

## Goal
Build a TypeScript module under `/home/user/myproject` that validates a directed graph using `arktype@2.2.0`. The graph nodes form a self-referential schema where each `Node` may reference other `Node`s through its `edges` array (so cycles are allowed). On top of structural shape validation, the implementation MUST also enforce cross-node structural integrity constraints: every edge target must resolve to a node that actually exists in the graph, every node id must be unique, and the declared root id must exist as a node id.

The shape rules are:
- `Node`:
  - `id`: a non-negative integer
  - `label`: a string whose length is between 1 and 40 (inclusive)
  - `edges`: an array of `Node` (self-referential; an edge points to another node, possibly forming a cycle)
- `Graph`:
  - `rootId`: a non-negative integer
  - `nodes`: an array of `Node`s with between 1 and 1000 elements

In addition to the shape, the following structural constraints MUST be enforced against the top-level `Graph` value:
1. All `nodes[*].id` values are unique.
2. Every edge target's `id` exists in `nodes` (i.e. for any node `n` in `nodes` and any `e` in `n.edges`, `e.id` must equal some `nodes[*].id`).
3. `rootId` exists in `nodes` (i.e. `rootId` equals some `nodes[*].id`).

## Test Criteria
1. A valid 3-node graph that contains an A -> B -> C -> A cycle MUST validate successfully and the validated `Graph` JSON MUST be printed.
2. A graph that contains two nodes sharing the same `id` MUST be rejected.
3. A graph where some edge points to an `id` that does not appear in `nodes` MUST be rejected.
4. A graph that contains a node with a negative `id` MUST be rejected.
5. A graph that contains a node whose `label` has length 41 MUST be rejected.
6. A graph whose `rootId` is not present in `nodes` MUST be rejected.
7. The validator source file MUST use `scope(` and `.export()` to define the schema, AND MUST attach at least one narrow predicate (e.g. `.narrow(`) to the `Graph` type to express the cross-node integrity constraints.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Command: `npx tsx cli.ts`
- Input: a single JSON payload of the shape `{"graph": <Graph>}` supplied via stdin.
- Output (stdout):
  - If the input is accepted: print exactly the line `VALID` followed by a newline, then a JSON-stringified object representing the validated `Graph` on the next line.
  - If the input is rejected: print exactly one line starting with `INVALID:` followed by a space and any error description.
- The CLI MUST exit with code 0 in BOTH the accept and reject cases (stdout decides the outcome).
- The TypeScript module file `src/validator.ts` MUST export a `validateGraph(input: unknown)` function that returns the validated `Graph` or throws on invalid input.
- The schema MUST be defined via `scope({...}).export()` to support `Node`'s self-reference (a single inline `type({...})` cannot express the cycle).
- The cross-node structural constraints (unique ids, edge target existence, rootId existence) MUST be enforced through one or more narrow predicates attached to the `Graph` type (e.g. `.narrow((g, ctx) => ...)`).
- `arktype@2.2.0` and `tsx` are preinstalled. `tsconfig.json` is preconfigured with `module: NodeNext` and `moduleResolution: NodeNext`.

