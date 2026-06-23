import { type } from "arktype";
const S = type({ status: "'idle'" });
console.log(S({ status: "idle", extra: "field" }).summary);
