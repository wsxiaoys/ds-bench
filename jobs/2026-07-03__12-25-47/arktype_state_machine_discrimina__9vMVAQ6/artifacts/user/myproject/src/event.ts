import { type } from "arktype";

// Reusable integer type narrowed to whole numbers.
const int = type("number").narrow((v, ctx) =>
  Number.isInteger(v) ? true : ctx.mustBe("integer")
);

// Discriminated union branches for Event. Each branch is keyed by a literal
// `type` tag so ArkType can resolve the correct variant.
export const Start = type({
  type: "'start'",
  at: "number",
});

export const Resolve = type({
  type: "'resolve'",
  data: "unknown",
  at: "number",
});

export const Reject = type({
  type: "'reject'",
  code: int,
  reason: "string",
  at: "number",
});

export const Reset = type({
  type: "'reset'",
});

// Combined Event union, explicitly built as a discriminated union via .or()
// chains over the literal-tagged branches.
export const Event = Start.or(Resolve).or(Reject).or(Reset);
