import { scope } from "arktype";

const types = scope({
    node: "file | directory",
    file: {
        name: "string>0",
        size: "number%1>0",
        "+": "reject"
    },
    directory: {
        name: "string>0",
        "children?": "node[]",
        "+": "reject"
    }
}).export();

const testCases = [
    { name: "foo" },
    { name: "foo", size: 10 },
    { name: "foo", children: [] },
    { name: "foo", size: 10, children: [] },
    { name: "" },
    { size: 10 }
];

for (const tc of testCases) {
    try {
        types.node.assert(tc);
        console.log("VALID", tc);
    } catch(e) {
        console.log("INVALID", tc, e.message);
    }
}
