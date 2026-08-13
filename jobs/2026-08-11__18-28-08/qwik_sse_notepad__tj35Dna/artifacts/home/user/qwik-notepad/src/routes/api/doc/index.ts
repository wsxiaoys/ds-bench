import type { RequestHandler } from '@builder.io/qwik-city';
import { serverState, formatSSE } from '~/server-state';

export const onGet: RequestHandler = async (requestEvent) => {
  // Set headers for SSE
  requestEvent.headers.set('Content-Type', 'text/event-stream');
  requestEvent.headers.set('Cache-Control', 'no-cache, no-transform');
  requestEvent.headers.set('Connection', 'keep-alive');
  
  const writableStream = requestEvent.getWritableStream();
  const writer = writableStream.getWriter();
  const encoder = new TextEncoder();
  
  const subscriberId = Math.random().toString(36).substring(2, 15);
  
  const sendUpdate = async (text: string, version: number): Promise<boolean> => {
    try {
      const msg = formatSSE(text, version);
      await writer.write(encoder.encode(msg));
      return true;
    } catch (e) {
      return false;
    }
  };
  
  // Add subscriber to global list
  serverState.addSubscriber({
    id: subscriberId,
    writer,
    sendUpdate,
  });
  
  // Immediately send the current document state
  const doc = serverState.getDoc();
  const initialSent = await sendUpdate(doc.text, doc.version);
  if (!initialSent) {
    serverState.removeSubscriber(subscriberId);
    return;
  }
  
  // Periodically send a heartbeat comment line to keep connection alive
  const heartbeatInterval = setInterval(async () => {
    try {
      await writer.write(encoder.encode(':\n\n'));
    } catch (e) {
      clearInterval(heartbeatInterval);
      serverState.removeSubscriber(subscriberId);
    }
  }, 1000);
  
  // Handle client disconnection
  requestEvent.request.signal.addEventListener('abort', () => {
    clearInterval(heartbeatInterval);
    serverState.removeSubscriber(subscriberId);
  });
};

export const onPost: RequestHandler = async (requestEvent) => {
  try {
    const body = await requestEvent.parseBody() as any;
    
    if (!body || typeof body !== 'object' || !('text' in body) || typeof body.text !== 'string') {
      requestEvent.status(400);
      requestEvent.json(400, { error: 'Invalid request body. "text" is required and must be a string.' });
      return;
    }
    
    const { text } = body;
    const updated = serverState.updateDoc(text);
    
    requestEvent.json(200, {
      version: updated.version,
      text: updated.text,
    });
  } catch (error: any) {
    requestEvent.status(400);
    requestEvent.json(400, { error: error.message || 'Malformed request body.' });
  }
};
