import { scope } from "arktype";

/**
 * Recursive directory tree schema declared inside an ArkType `scope` so the
 * node type can reference itself via its exported alias.
 *
 * A node carries:
 *   - `name`     : a non-empty string
 *   - `size?`    : optional positive integer present on files only
 *   - `children?`: optional array of nested nodes present on directories only
 *
 * After the scope is built, `.narrow(...)` enforces mutual exclusion so that
 * a node cannot simultaneously declare both `size` and `children`. ArkType
 * permits extra keys by default (`onUndeclaredKey: "ignore"`), which would
 * otherwise let a "file" smuggle in a `children` array, so we add this guard.
 */
export const treeScope = scope({
  directoryTreeNode: {
    name: "string > 0",
    "size?": "number.integer > 0",
    "children?": "directoryTreeNode[]",
  },
}).export();

const { directoryTreeNode: baseDirectoryTreeNode } = treeScope;

const directoryTreeNode = baseDirectoryTreeNode.narrow(
  (data) =>
    data === null ||
    typeof data !== "object" ||
    !(data.size !== undefined && Array.isArray(data.children)),
);

/**
 * Validate an arbitrary input value as a recursive directory tree node.
 *
 * Uses ArkType's `.assert(...)` so that any deviation from the schema throws
 * a `TraversalError` (an `ArkError`) instead of returning an `ArkErrors`
 * object.
 *
 * @param input - The value to validate (typically parsed JSON).
 * @returns The validated tree node, structurally identical to the input.
 * @throws When `input` does not satisfy the directory tree schema.
 */
export function validateDirectoryTree(input: unknown): unknown {
  return directoryTreeNode.assert(input);
}

export default validateDirectoryTree;