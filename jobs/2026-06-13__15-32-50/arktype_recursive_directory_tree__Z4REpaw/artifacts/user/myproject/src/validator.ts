import { scope } from "arktype";

// Define the schema using scope as required by Criterion 6.
// Each node is either a file or a directory.
// - A file has a name (non-empty string), an optional size (positive integer), and MUST NOT have children.
// - A directory has a name (non-empty string), an optional children array of nested nodes, and MUST NOT have a size.
export const types = scope({
  node: "file | directory",
  file: {
    name: "string > 0",
    "size?": "number % 1 > 0",
    "children?": "undefined"
  },
  directory: {
    name: "string > 0",
    "children?": "node[]",
    "size?": "undefined"
  }
}).export();

/**
 * Validates a filesystem-style directory tree.
 * Returns the validated tree or throws an ArkType error via `.assert(...)`.
 * 
 * @param input The input to validate
 * @returns The validated directory tree structure
 */
export function validateDirectoryTree(input: unknown) {
  return types.node.assert(input);
}
