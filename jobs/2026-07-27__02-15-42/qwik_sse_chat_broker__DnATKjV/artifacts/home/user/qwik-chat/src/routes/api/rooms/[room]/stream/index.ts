import type { RequestHandler } from "@builder.io/qwik-city";
import { db, broker, type Message, type Subscriber } from "../../../../../lib/state";

export const onGet: RequestHandler = async (requestEvent) => {
  const room = requestEvent.params.room;
  if (!room || !/^[A-Za-z0-9_-]+$/.test(room)) {
    requestEvent.json(400, { error: "Invalid room name" });
    return;
  }

  // Set SSE headers
  requestEvent.status(200);
  requestEvent.headers.set("Content-Type", "text/event-stream");
  requestEvent.headers.set("Cache-Control", "no-cache, no-transform");
  requestEvent.headers.set("Connection", "keep-alive");

  const writableStream = requestEvent.getWritableStream();
  const writer = writableStream.getWriter();
  const encoder = new TextEncoder();

  let active = true;
  let cleanedUp = false;

  const subscriberId = Math.random().toString(36).substring(2);

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    active = false;
    broker.unsubscribe(room, sub);
    try {
      writer.close().catch(() => {});
    } catch {
      // ignore
    }
  };

  requestEvent.signal.addEventListener("abort", cleanup);

  async function writeMessageToSSE(msg: Message) {
    if (!active) return;
    const jsonStr = JSON.stringify({
      room: msg.room,
      seq: msg.seq,
      user: msg.user,
      text: msg.text,
      ts: msg.ts,
    });
    const data = `id: ${msg.seq}\nevent: message\ndata: ${jsonStr}\n\n`;
    try {
      await writer.write(encoder.encode(data));
    } catch {
      cleanup();
    }
  }

  const sub: Subscriber = {
    id: subscriberId,
    room,
    send: (msg) => {
      if (sub.isReplaying) {
        sub.queue.push(msg);
      } else {
        if (msg.seq > sub.highestSentSeq) {
          sub.highestSentSeq = msg.seq;
          writeMessageToSSE(msg).catch(() => {});
        }
      }
    },
    queue: [],
    isReplaying: true,
    highestSentSeq: -1,
  };

  // 1. Subscribe to broker
  broker.subscribe(room, sub);

  // 2. Parse Last-Event-ID
  const lastEventIdHeader = requestEvent.request.headers.get("last-event-id");
  let lastEventId: number | null = null;
  if (lastEventIdHeader !== null) {
    const parsed = parseInt(lastEventIdHeader, 10);
    if (!isNaN(parsed)) {
      lastEventId = parsed;
    }
  }

  sub.highestSentSeq = lastEventId !== null ? lastEventId : -1;

  // 3. Fetch history
  let history: Message[] = [];
  try {
    if (lastEventId !== null) {
      history = db.prepare(`
        SELECT room, seq, user, text, ts
        FROM messages
        WHERE room = ? AND seq > ?
        ORDER BY seq ASC
      `).all(room, lastEventId) as Message[];
    } else {
      const descHistory = db.prepare(`
        SELECT room, seq, user, text, ts
        FROM messages
        WHERE room = ?
        ORDER BY seq DESC
        LIMIT 50
      `).all(room) as Message[];
      history = descHistory.reverse();
    }
  } catch {
    cleanup();
    return;
  }

  // 4. Send history
  for (const msg of history) {
    if (msg.seq > sub.highestSentSeq) {
      sub.highestSentSeq = msg.seq;
      await writeMessageToSSE(msg);
    }
  }

  // 5. Send queued live messages
  sub.isReplaying = false;
  const queued = [...sub.queue];
  sub.queue = [];
  for (const msg of queued) {
    if (msg.seq > sub.highestSentSeq) {
      sub.highestSentSeq = msg.seq;
      await writeMessageToSSE(msg);
    }
  }

  // Keep connection open until client aborts
  await new Promise<void>((resolve) => {
    requestEvent.signal.addEventListener("abort", () => {
      cleanup();
      resolve();
    });
  });
};
