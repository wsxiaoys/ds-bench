import { type } from "arktype";

// Define the tuple-shaped parameter schema
export const eventParams = type([
  "1 <= string <= 50 & /^[a-zA-Z0-9]+$/",
  "number>=0 % 1",
  [[{ kind: "string", data: "unknown" }, "|", "undefined"], "?"],
  "...",
  "(1 <= string <= 30)[]"
]);

export const emit = type.fn(
  "1 <= string <= 50 & /^[a-zA-Z0-9]+$/",
  "number>=0 % 1",
  [[{ kind: "string", data: "unknown" }, "|", "undefined"], "?"],
  "...",
  "(1 <= string <= 30)[]"
)((eventName, timestamp, payload, ...tags) => {
  const event: {
    name: string;
    timestamp: number;
    payload?: { kind: string; data: unknown };
    tags: string[];
  } = {
    name: eventName,
    timestamp,
    tags,
  };

  if (payload !== undefined) {
    event.payload = payload;
  }

  return {
    ok: true,
    event,
  };
});
