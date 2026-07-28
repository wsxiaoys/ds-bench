import type { RequestHandler } from "@builder.io/qwik-city";
import { getMessagesAfter, getRecentMessages, type ChatMessage } from "~/lib/db";
import { broker } from "~/lib/broker";

const DEFAULT_REPLAY_LIMIT = 50;

export const onGet: RequestHandler = async (ev) => {
  const room = ev.params.room;

  ev.headers.set("Content-Type", "text/event-stream; charset=utf-8");
  ev.headers.set("Cache-Control", "no-cache, no-transform");
  ev.headers.set("Connection", "keep-alive");
  // Prevent reverse proxies (e.g. nginx) from buffering the stream.
  ev.headers.set("X-Accel-Buffering", "no");

  const writer = ev.getWritableStream().getWriter();
  const encoder = new TextEncoder();

  let closed = false;
  let writeChain: Promise<void> = Promise.resolve();

  const frameOf = (msg: ChatMessage) =>
    `id: ${msg.seq}\nevent: message\ndata: ${JSON.stringify(msg)}\n\n`;

  const rawWrite = async (msg: ChatMessage) => {
    if (closed) return;
    try {
      await writer.write(encoder.encode(frameOf(msg)));
    } catch {
      teardown();
    }
  };

  // Chaining each write onto a single promise chain guarantees strict
  // in-order delivery on the wire: a write is only started once the
  // previous one has settled. Combined with the fact that `enqueue` is
  // always invoked synchronously (either from the backlog loop below, or
  // synchronously from the broker's `publish`), the order in which
  // `enqueue` is called is exactly the order messages are written.
  const enqueue = (msg: ChatMessage) => {
    writeChain = writeChain.then(() => rawWrite(msg));
  };

  function teardown() {
    if (closed) return;
    closed = true;
    unsubscribe();
    writer.close().catch(() => {});
  }

  // Subscribe FIRST, synchronously. From this instant on, any message
  // published to this room is delivered to `enqueue`. The backlog query
  // immediately below is also fully synchronous (better-sqlite3 is a
  // blocking API) with no `await` in between, so there is no window in
  // which the JS event loop could run other code (e.g. a concurrent POST
  // publishing a message). This makes it impossible to miss a message
  // published concurrently with connecting, and impossible to duplicate a
  // message that is already included in the backlog snapshot.
  const unsubscribe = broker.subscribe(room, enqueue);

  const lastEventIdHeader = ev.request.headers.get("Last-Event-ID");
  let backlog: ChatMessage[];
  if (lastEventIdHeader !== null && /^-?\d+$/.test(lastEventIdHeader.trim())) {
    const lastSeq = parseInt(lastEventIdHeader.trim(), 10);
    backlog = getMessagesAfter(room, lastSeq);
  } else {
    backlog = getRecentMessages(room, DEFAULT_REPLAY_LIMIT);
  }

  for (const msg of backlog) {
    enqueue(msg);
  }

  if (ev.signal.aborted) {
    teardown();
    return;
  }

  await new Promise<void>((resolve) => {
    ev.signal.addEventListener("abort", () => resolve(), { once: true });
  });

  teardown();
};
