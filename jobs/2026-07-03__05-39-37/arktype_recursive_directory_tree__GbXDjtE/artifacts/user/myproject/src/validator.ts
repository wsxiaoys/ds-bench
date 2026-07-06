import { scope } from "arktype"

/**
 * A recursive directory-tree schema built with ArkType's `scope(...).export()`.
 *
 * A node is either a **file** or a **directory**:
 *
 * - File:      `{ name, size }`  — `size` is a positive integer, no `children`.
 * - Directory: `{ name, children }` — `children` is a list of nested nodes, no `size`.
 *
 * `name` is always a non-empty string. Only directories may contain children,
 * and only files may carry a size, so a node that mixes the two is rejected.
 */
const types = scope({
	File: {
		name: "string >= 1",
		size: "number.integer > 0"
	},
	Directory: {
		name: "string >= 1",
		children: "Node[]"
	},
	Node: "File | Directory"
}).export()

/**
 * The validated directory-tree type, with undeclared keys rejected at every
 * level so that a file carrying `children` (or a directory carrying `size`)
 * is considered invalid.
 */
const DirectoryTree = types.Node.onDeepUndeclaredKey("reject")

export type DirectoryTree = typeof DirectoryTree.infer

/**
 * Validate a filesystem-style directory tree using ArkType's `.assert(...)` API.
 *
 * @returns the validated tree on success.
 * @throws  an ArkType `TraversalError` describing the problem on failure.
 */
export function validateDirectoryTree(input: unknown): DirectoryTree {
	return DirectoryTree.assert(input)
}