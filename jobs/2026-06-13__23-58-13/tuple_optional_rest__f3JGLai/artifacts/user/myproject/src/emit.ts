import { type } from "arktype";

export const emit = type.fn(
  "1<=string.alphanumeric<=50",
  "number%1>=0",
  [{ kind: "string", data: "unknown" }, "?"],
  "...", "(1<=string<=30)[]"
)((eventName, timestamp, payload, ...tags) => {
  const event: any = { name: eventName, timestamp, tags };
  if (payload !== undefined) {
    event.payload = payload;
  }
  return { ok: true, event };
});
