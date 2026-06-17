import { scope } from "arktype";

const types = scope({
    node: "file | directory",
    file: {
        name: "string>0",
        size: "integer>0"
    },
    directory: {
        name: "string>0",
        "children?": "node[]"
    }
}).export();

try {
    const res = types.node.assert({ name: "foo", size: 10, children: [] });
    console.log("VALID", res);
} catch(e) {
    console.log("INVALID:", e.message);
}

try {
    const res2 = types.node.assert({ name: "dir", children: [{ name: "file", size: 10 }] });
    console.log("VALID", res2);
} catch(e) {
    console.log("INVALID:", e.message);
}
