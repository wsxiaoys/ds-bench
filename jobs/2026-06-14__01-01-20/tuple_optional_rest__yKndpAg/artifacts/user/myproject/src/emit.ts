import { type } from "arktype";

// The tuple schema: [eventName, timestamp, payload?, ...tags]
// where:
//   eventName: alphanumeric string, length 1-50
//   timestamp: non-negative integer
//   payload (optional): { kind: string, data: unknown }
//   tags: variadic rest of strings, each length 1-30
const emitSchema = type.fn(
  "string.alphanumeric & 1<=length<=50",
  "integer>=0",
  ["{ kind: string, data: unknown }", "?"],
  "...",
  "1<=length<=30"
);

export const emit = emitSchema(
  (eventName: string, timestamp: number, payload?: { kind: string; data: unknown }, ...tags: string[]) => {
    const event: Record<string, unknown> = {
      name: eventName,
      timestamp,
    };
    if (payload !== undefined) {
      event.payload = payload;
    }
    if (tags.length > 0) {
      event.tags = tags;
    }
    return { ok: true as const, event };
  }
);
