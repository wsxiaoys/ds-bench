import { scope } from "arktype";

export const types = scope({
    node: "file | directory",
    file: {
        name: "string>0",
        "size?": "number%1>0",
        "+": "reject"
    },
    directory: {
        name: "string>0",
        "children?": "node[]",
        "+": "reject"
    }
}).export();

export function validateDirectoryTree(input: unknown) {
    return types.node.assert(input);
}
