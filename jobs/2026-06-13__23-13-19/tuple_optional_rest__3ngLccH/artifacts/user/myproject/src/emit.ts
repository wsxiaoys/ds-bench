import { type } from "arktype";

export const emit = type.fn(
  "1 <= string.alphanumeric <= 50",
  "number.integer >= 0",
  [[{ kind: "string", data: "unknown" }, "|", "undefined | null"], "?"],
  "...",
  "1 <= string <= 30[]"
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

  if (payload !== undefined && payload !== null) {
    event.payload = payload as any;
  }

  return {
    ok: true,
    event,
  } as const;
});
