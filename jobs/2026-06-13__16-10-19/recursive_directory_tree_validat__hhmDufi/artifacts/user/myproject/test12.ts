import { scope } from "arktype";

const types = scope({
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

try {
    types.node.assert({ name: "foo" });
    console.log("VALID");
} catch(e) {
    console.log("INVALID", e.message);
}
