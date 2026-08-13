import type { RequestHandler } from "@builder.io/qwik-city";
import { subscribe, getMessagesAfter, getRecentMessages, type Message } from "~/lib/chat";

export const onGet: RequestHandler = async (ev) => {
  const { params, request, headers, getWritableStream, signal, json } = ev;
  const room = params.room;

  // Validate room parameter
  if (!room || !/^[A-Za-z0-9_-]+$/.test(room)) {
    json(400, { error: "Invalid room name" });
    return;
  }

  if (signal.aborted) {
    return;
  }

  // Parse Last-Event-ID header
  const lastEventIdStr = request.headers.get("last-event-id");
  let lastEventId: number | null = null;
  if (lastEventIdStr !== null) {
    const parsed = parseInt(lastEventIdStr, 10);
    if (!isNaN(parsed)) {
      lastEventId = parsed;
    }
  }

  let initialMessages: Message[];
  if (lastEventId !== null) {
    initialMessages = getMessagesAfter(room, lastEventId);
  } else {
    initialMessages = getRecentMessages(room, 50);
  }

  // Set SSE response headers
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache, no-transform");
  headers.set("Connection", "keep-alive");

  const writableStream = getWritableStream();
  const writer = writableStream.getWriter();
  const encoder = new TextEncoder();

  let sendingHistory = true;
  let lastSentSeq = lastEventId ?? 0;
  const queue: Message[] = [];

  const formatSSE = (msg: Message): string => {
    const jsonStr = JSON.stringify({
      room: msg.room,
      seq: msg.seq,
      user: msg.user,
      text: msg.text,
      ts: msg.ts
    });
    return `id: ${msg.seq}\nevent: message\ndata: ${jsonStr}\n\n`;
  };

  const writeMsg = async (msg: Message) => {
    await writer.write(encoder.encode(formatSSE(msg)));
    lastSentSeq = msg.seq;
  };

  return new Promise<void>((resolve) => {
    let isProcessing = false;
    let resolved = false;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      unsubscribe();
      try {
        writer.releaseLock();
      } catch {
        // Ignore error
      }
      resolve();
    };

    const processQueue = async () => {
      if (isProcessing || resolved) return;
      isProcessing = true;
      try {
        while (queue.length > 0 && !resolved) {
          const msg = queue.shift()!;
          if (msg.seq > lastSentSeq) {
            await writeMsg(msg);
          }
        }
      } catch {
        cleanup();
      } finally {
        isProcessing = false;
      }
    };

    const unsubscribe = subscribe(room, (msg) => {
      queue.push(msg);
      if (!sendingHistory) {
        processQueue();
      }
    });

    signal.addEventListener("abort", cleanup);

    // Self-executing async function to send history and transition to live mode
    (async () => {
      try {
        for (const msg of initialMessages) {
          if (resolved) return;
          if (msg.seq > lastSentSeq) {
            await writeMsg(msg);
          }
        }
        sendingHistory = false;
        await processQueue();
      } catch {
        cleanup();
      }
    })();
  });
};
