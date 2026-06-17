import { scope } from "arktype";

const types = scope({
    node: "file | directory",
    file: {
        name: "string>0",
        size: "number%1>0",
        "children?": "never"
    },
    directory: {
        name: "string>0",
        "size?": "never",
        "children?": "node[]"
    }
}).export();

console.log("Empty node:", types.node({ name: "foo" }).problems ? "INVALID" : "VALID");
console.log("File:", types.node({ name: "foo", size: 10 }).problems ? "INVALID" : "VALID");
console.log("Dir:", types.node({ name: "foo", children: [] }).problems ? "INVALID" : "VALID");
console.log("Both:", types.node({ name: "foo", size: 10, children: [] }).problems ? "INVALID" : "VALID");
