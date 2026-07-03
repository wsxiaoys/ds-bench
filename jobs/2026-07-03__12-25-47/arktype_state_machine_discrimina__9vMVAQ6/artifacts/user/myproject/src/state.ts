import { type } from "arktype";

// Discriminated union branches for State. Each branch is keyed by a literal
// `status` tag so ArkType can resolve the correct variant.
export const Idle = type({
  status: "'idle'",
});

export const Loading = type({
  status: "'loading'",
  startedAt: "number >= 0",
});

export const Success = type({
  status: "'success'",
  data: "unknown",
  fetchedAt: "number >= 0",
});

export const Failure = type({
  status: "'failure'",
  code: "400 <= number <= 599",
  reason: "1 <= string <= 200",
});

// Combined State union, explicitly built as a discriminated union via .or()
// chains over the literal-tagged branches.
export const State = Idle.or(Loading).or(Success).or(Failure);
