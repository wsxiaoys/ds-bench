import { scope } from "arktype"

// Define the schema using scope(...).export()
const types = scope({
    Node: "File | Directory",
    File: {
        name: "string > 0",
        size: "number.integer > 0",
        "children?": "undefined"
    },
    Directory: {
        name: "string > 0",
        "size?": "undefined",
        "children?": "Node[]"
    }
}).export()

/**
 * Validates a filesystem-style directory tree.
 * Returns the validated tree or throws an error.
 * Uses ArkType's `.assert(...)` API.
 */
export function validateDirectoryTree(input: unknown) {
    return types.Node.assert(input)
}

// Export the inferred type for external usage
export type DirectoryTree = typeof types.Node.infer
