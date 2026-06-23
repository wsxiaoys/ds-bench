import { type } from "arktype";
const S = type({ status: "'idle'", "+": "reject" });
console.log(S({ status: "idle", extra: "field" }).summary);
