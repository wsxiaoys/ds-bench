import { type } from "arktype";
const t = type({ a: "string", "+": "reject" });
try {
    t.assert({ a: "hi", b: 1 });
    console.log("VALID");
} catch(e) {
    console.log("INVALID", e.message);
}
