import { scope } from "arktype";

// A directory tree node is one of two mutually-exclusive shapes:
//
//   fileNode      — has `name` (non-empty string) and `size` (positive integer).
//                   Extra properties are rejected ("+": "reject") so that a
//                   file node cannot simultaneously carry a `children` array.
//
//   directoryNode — has `name` (non-empty string), an optional `children` array
//                   of nested treeNodes, and an explicit `size?: never` so that
//                   a node carrying both `size` and `children` is rejected.
//
//   treeNode      — the public union type (fileNode | directoryNode).
//
// The schema is defined via scope(...).export() as required.

const trees = scope({
  fileNode: {
    "+": "reject",
    name: "string > 0",
    size: "number.integer > 0",
  },
  directoryNode: {
    name: "string > 0",
    "size?": "never",
    "children?": "(fileNode | directoryNode)[]",
  },
  treeNode: "fileNode | directoryNode",
});

export const { treeNode, fileNode, directoryNode } = trees.export();

export type TreeNode = typeof treeNode.infer;

/**
 * Validates `input` as a recursive directory-tree node.
 *
 * Returns the validated (typed) tree on success.
 * Throws an `ArkErrors` instance (via `.assert()`) on failure.
 */
export function validateDirectoryTree(input: unknown): TreeNode {
  return treeNode.assert(input);
}
