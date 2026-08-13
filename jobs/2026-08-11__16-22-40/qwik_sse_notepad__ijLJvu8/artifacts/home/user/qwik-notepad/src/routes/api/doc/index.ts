import { type RequestHandler } from "@builder.io/qwik-city";
import { state } from "../../../state";

function formatSSEUpdate(version: number, text: string): string {
  const lines = text.split("\n");
  const dataLines = lines.map((line) => `data: ${line}`).join("\n");
  return `event: update\nid: ${version}\n${dataLines}\n\n`;
}

export const onGet: RequestHandler = async (requestEvent) => {
  // Set headers for SSE
  requestEvent.headers.set("content-type", "text/event-stream");
  requestEvent.headers.set("cache-control", "no-cache, no-transform");
  requestEvent.headers.set("connection", "keep-alive");
  requestEvent.headers.set("x-accel-buffering", "no");

  const subId = crypto.randomUUID();
  const writableStream = requestEvent.getWritableStream();
  const writer = writableStream.getWriter();
  const encoder = new TextEncoder();

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    state.subscribers.delete(subId);
    clearInterval(heartbeatInterval);
    try {
      writer.close();
    } catch (e) {}
  };

  const send = async (msg: string) => {
    try {
      await writer.write(encoder.encode(msg));
    } catch (e) {
      cleanup();
    }
  };

  // Keep alive heartbeat (at least once per second)
  const heartbeatInterval = setInterval(async () => {
    try {
      await writer.write(encoder.encode(":\n\n"));
    } catch (e) {
      cleanup();
    }
  }, 1000);

  // Register subscriber
  state.subscribers.set(subId, {
    id: subId,
    send,
    close: cleanup,
  });

  // Handle client disconnect
  requestEvent.request.signal.addEventListener("abort", cleanup);

  // Immediately send current document snapshot on connect
  await send(formatSSEUpdate(state.version, state.text));

  // Keep the request stream open until aborted
  await new Promise<void>((resolve) => {
    requestEvent.request.signal.addEventListener("abort", () => {
      cleanup();
      resolve();
    });
  });
};

export const onPost: RequestHandler = async (requestEvent) => {
  let body: any;
  try {
    body = await requestEvent.parseBody();
    if (!body) {
      body = await requestEvent.request.json();
    }
  } catch (e) {}

  if (!body || typeof body !== "object" || typeof body.text !== "string") {
    requestEvent.json(400, { error: 'Invalid request body. "text" is required and must be a string.' });
    return;
  }

  // Atomically update version and text
  state.version += 1;
  state.text = body.text;

  // Broadcast update to all subscribers
  const msg = formatSSEUpdate(state.version, state.text);
  for (const subscriber of state.subscribers.values()) {
    subscriber.send(msg);
  }

  requestEvent.json(200, { version: state.version, text: state.text });
};
