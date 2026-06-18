import { scope } from "arktype";

// Define the recursive DirectoryTree type using scope().export()
// A node is either:
//   - FileNode: has name (non-empty string) and size (positive integer), no children
//   - DirNode: has name (non-empty string) and children (array of tree nodes), no size
// Only directories may contain children; files (with size) must not have children.

const DirectoryTreeModule = scope({
  TreeNode: "FileNode | DirNode",
  FileNode: {
    name: "string > 0",
    size: "number % 1 > 0",
    "+": "reject",
  },
  DirNode: {
    name: "string > 0",
    children: "TreeNode[]",
    "+": "reject",
  },
}).export();

/**
 * Validates a filesystem-style directory tree.
 * Returns the validated tree on success, or throws an ArkType error on failure.
 */
export function validateDirectoryTree(input: unknown) {
  return DirectoryTreeModule.TreeNode.assert(input);
}
