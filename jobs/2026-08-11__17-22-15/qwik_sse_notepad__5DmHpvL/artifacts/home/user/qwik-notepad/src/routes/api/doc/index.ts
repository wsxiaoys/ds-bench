import type { RequestHandler } from '@builder.io/qwik-city';
import { docState } from '../../../server/state';

let nextClientId = 1;

export const onGet: RequestHandler = async (requestEvent) => {
  requestEvent.headers.set('Content-Type', 'text/event-stream');
  requestEvent.headers.set('Cache-Control', 'no-cache, no-store, no-transform');
  requestEvent.headers.set('Connection', 'keep-alive');
  
  // Immediately flush status 200
  requestEvent.status(200);

  const writableStream = requestEvent.getWritableStream();
  const writer = writableStream.getWriter();
  const encoder = new TextEncoder();

  const clientId = `client_${nextClientId++}`;
  
  let isClosed = false;

  const cleanup = () => {
    if (isClosed) return;
    isClosed = true;
    docState.removeSubscriber(clientId);
    try {
      writer.close().catch(() => {});
    } catch (e) {}
  };

  const send = async (msg: string): Promise<boolean> => {
    if (isClosed) return false;
    try {
      await writer.write(encoder.encode(msg));
      return true;
    } catch (err) {
      cleanup();
      return false;
    }
  };

  // Add subscriber to state
  docState.addSubscriber(clientId, { id: clientId, send });

  // Immediately upon connecting, emit the current document as an SSE message
  const initialMsg = docState.formatSSEUpdate(docState.getVersion(), docState.getText());
  await send(initialMsg);

  // Set up heartbeat (periodically emit SSE comment line starting with : at least once per second)
  const heartbeatInterval = setInterval(async () => {
    if (isClosed) {
      clearInterval(heartbeatInterval);
      return;
    }
    const ok = await send(':\n\n');
    if (!ok) {
      clearInterval(heartbeatInterval);
    }
  }, 1000);

  // Clean up when request aborted
  requestEvent.request.signal.addEventListener('abort', () => {
    clearInterval(heartbeatInterval);
    cleanup();
  });
};

export const onPost: RequestHandler = async (requestEvent) => {
  let body: any;
  try {
    body = await requestEvent.request.json();
  } catch (err) {
    requestEvent.json(400, { error: "Invalid JSON body" });
    return;
  }

  if (!body || typeof body.text !== 'string') {
    requestEvent.json(400, { error: "Missing or invalid 'text' field" });
    return;
  }

  const { version, text } = docState.updateDocument(body.text);
  requestEvent.json(200, { version, text });
};
