import { type } from "arktype";

// State is a discriminated union over the "status" literal field.
// Each branch has a distinct status literal so ArkType can deterministically resolve them.
export const State = type(
  { status: "'idle'" },
  "|",
  { status: "'loading'", startedAt: "number >= 0" },
  "|",
  { status: "'success'", data: "unknown", fetchedAt: "number >= 0" },
  "|",
  { status: "'failure'", code: "400 <= number <= 599", reason: "1 <= string <= 200" }
);

// Event is a discriminated union over the "type" literal field.
export const Event = type(
  { type: "'start'", at: "number" },
  "|",
  { type: "'resolve'", data: "unknown", at: "number" },
  "|",
  { type: "'reject'", code: "number", reason: "string", at: "number" },
  "|",
  { type: "'reset'" }
);

export type State = typeof State.infer;
export type Event = typeof Event.infer;
