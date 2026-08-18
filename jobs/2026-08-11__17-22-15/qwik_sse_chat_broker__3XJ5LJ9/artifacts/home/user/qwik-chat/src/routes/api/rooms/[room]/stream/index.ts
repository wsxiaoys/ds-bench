import type { RequestHandler } from "@builder.io/qwik-city";
import { db, broker, type Message } from "../../../../../lib/db";

export const onGet: RequestHandler = async (event) => {
  const { params, headers, status, getWritableStream, request, signal, json } = event;

  // 1. Validate room parameter
  const room = params.room;
  const roomRegex = /^[A-Za-z0-9_-]+$/;
  if (!room || !roomRegex.test(room)) {
    json(400, { error: "Invalid room name" });
    return;
  }

  // 2. Set headers for SSE stream
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache, no-transform");
  headers.set("Connection", "keep-alive");
  headers.set("X-Accel-Buffering", "no");

  status(200);

  // 3. Get writable stream
  const stream = getWritableStream();
  const writer = stream.getWriter();
  const encoder = new TextEncoder();

  let closed = false;

  // 4. Parse Last-Event-ID header
  const lastEventIdHeader = request.headers.get("last-event-id");
  let L: number | null = null;
  if (lastEventIdHeader !== null) {
    const parsed = parseInt(lastEventIdHeader, 10);
    if (!isNaN(parsed)) {
      L = parsed;
    }
  }

  // 5. Setup subscription and queue
  const queue: Message[] = [];
  let replaying = true;
  let maxSeq = L !== null ? L : 0;

  const unsubscribe = broker.subscribe(room, (msg: Message) => {
    if (replaying) {
      queue.push(msg);
    } else {
      if (msg.seq > maxSeq) {
        sendEvent(msg);
        maxSeq = msg.seq;
      }
    }
  });

  const cleanup = () => {
    if (closed) return;
    closed = true;
    unsubscribe();
    clearInterval(keepAliveInterval);
    try {
      writer.close();
    } catch {
      // Ignore errors when closing the writer
    }
  };

  signal.addEventListener("abort", cleanup);

  function sendEvent(msg: Message) {
    if (closed) return;
    const jsonStr = JSON.stringify({
      room: msg.room,
      seq: msg.seq,
      user: msg.user,
      text: msg.text,
      ts: msg.ts,
    });
    const chunk = `id: ${msg.seq}\nevent: message\ndata: ${jsonStr}\n\n`;
    writer.write(encoder.encode(chunk)).catch(() => {
      cleanup();
    });
  }

  // Send a keep-alive comment periodically to detect disconnected clients
  const keepAliveInterval = setInterval(() => {
    if (closed) return;
    writer.write(encoder.encode(":\n\n")).catch(() => {
      cleanup();
    });
  }, 15000);

  // 6. Query history
  let history: Message[] = [];
  try {
    if (L !== null) {
      history = db.prepare(
        "SELECT room, seq, user, text, ts FROM messages WHERE room = ? AND seq > ? ORDER BY seq ASC"
      ).all(room, L) as Message[];
    } else {
      const rows = db.prepare(
        "SELECT room, seq, user, text, ts FROM messages WHERE room = ? ORDER BY seq DESC LIMIT 50"
      ).all(room) as Message[];
      history = rows.reverse();
    }
  } catch (err) {
    console.error("Failed to query history:", err);
    cleanup();
    return;
  }

  // 7. Emit history
  for (const msg of history) {
    if (msg.seq > maxSeq) {
      sendEvent(msg);
      maxSeq = msg.seq;
    }
  }

  // 8. Emit buffered queue
  for (const msg of queue) {
    if (msg.seq > maxSeq) {
      sendEvent(msg);
      maxSeq = msg.seq;
    }
  }

  // 9. Transition to live stream
  replaying = false;
};
