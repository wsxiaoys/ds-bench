import { type, TraversalError } from "arktype";

// Quick test of the fn syntax
const testFn = type.fn(
  "string.alphanumeric & 1<=length<=50",
  "integer>=0",
  ["{ kind: string, data: unknown }", "?"],
  "...",
  ["string & 1<=length<=30", "[]"]
);

const emit = testFn(
  (eventName, timestamp, payload, ...tags) => {
    console.log("eventName:", eventName);
    console.log("timestamp:", timestamp);
    console.log("payload:", payload);
    console.log("tags:", tags);
    return { ok: true, event: { name: eventName, timestamp, ...(payload !== undefined ? { payload } : {}), ...(tags.length > 0 ? { tags } : {}) } };
  }
);

// Test valid input
try {
  const result = emit("test123", 100, { kind: "click", data: null }, "tag1", "tag2");
  console.log("Result:", JSON.stringify(result));
} catch (e) {
  if (e instanceof TraversalError) {
    console.log("TraversalError:", e.message);
  } else {
    console.log("Other error:", e);
  }
}

// Test without payload
try {
  const result = emit("test456", 200, "tag1");
  console.log("Result (no payload):", JSON.stringify(result));
} catch (e) {
  if (e instanceof TraversalError) {
    console.log("TraversalError:", e.message);
  } else {
    console.log("Other error:", e);
  }
}

// Test invalid input
try {
  const result = emit("", 100);
  console.log("Result:", JSON.stringify(result));
} catch (e) {
  if (e instanceof TraversalError) {
    console.log("TraversalError:", e.message);
  } else {
    console.log("Other error:", e);
  }
}
