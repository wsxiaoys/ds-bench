import type { RequestHandler } from '@builder.io/qwik-city';
import { db } from '~/lib/db';
import { broker } from '~/lib/broker';
import { Subscriber } from '~/lib/subscriber';
import type { Message } from '~/lib/types';

export const onGet: RequestHandler = async ({ params, request, status, headers, getWritableStream, signal, json }) => {
  const room = params.room;
  if (!room || !/^[A-Za-z0-9_-]+$/.test(room)) {
    json(400, { error: "Invalid room name" });
    return;
  }

  // Set the response status and headers for SSE BEFORE calling getWritableStream()
  status(200);
  headers.set('Content-Type', 'text/event-stream');
  headers.set('Cache-Control', 'no-cache, no-transform');
  headers.set('Connection', 'keep-alive');
  headers.set('X-Accel-Buffering', 'no');

  const writable = getWritableStream();
  const writer = writable.getWriter();

  // Parse Last-Event-ID header
  const lastEventIdHeader = request.headers.get('last-event-id');
  let lastEventId: number | null = null;
  if (lastEventIdHeader !== null) {
    const parsed = parseInt(lastEventIdHeader, 10);
    if (!isNaN(parsed)) {
      lastEventId = parsed;
    }
  }

  const initialSeq = lastEventId ?? 0;
  const subscriberId = Math.random().toString(36).substring(2, 15);
  const subscriber = new Subscriber(subscriberId, room, writer, initialSeq);

  // Subscribe to the broker BEFORE querying the database
  broker.subscribe(room, subscriber);

  // Setup abort/disconnect listener
  let isCleanedUp = false;
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    broker.unsubscribe(room, subscriber);
  };

  signal.addEventListener('abort', cleanup);

  try {
    // Fetch replay messages synchronously from SQLite
    let replayMessages: Message[] = [];
    if (lastEventId !== null) {
      replayMessages = db.prepare(
        'SELECT room, seq, user, text, ts FROM messages WHERE room = ? AND seq > ? ORDER BY seq ASC'
      ).all(room, lastEventId) as Message[];
    } else {
      replayMessages = db.prepare(
        'SELECT room, seq, user, text, ts FROM (SELECT room, seq, user, text, ts FROM messages WHERE room = ? ORDER BY seq DESC LIMIT 50) ORDER BY seq ASC'
      ).all(room) as Message[];
    }

    // Transition subscriber to live (sends replay, then drains queue, then goes live)
    await subscriber.transitionToLive(replayMessages);
  } catch (err) {
    cleanup();
  }
};
