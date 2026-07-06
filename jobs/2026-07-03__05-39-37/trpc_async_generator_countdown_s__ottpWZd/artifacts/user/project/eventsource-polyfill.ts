/**
 * Minimal EventSource polyfill for Node.js using the built-in `fetch` API.
 * Implements the subset of the EventSource interface that tRPC's
 * `httpSubscriptionLink` relies on.
 */

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

interface EventSourceListener {
  (event: Event): void;
}

interface PolyfillMessageEvent {
  data: string;
  lastEventId?: string;
}

class PolyfillEventSource {
  static readonly CONNECTING = CONNECTING;
  static readonly OPEN = OPEN;
  static readonly CLOSED = CLOSED;

  readonly CLOSED = CLOSED;
  readonly CONNECTING = CONNECTING;
  readonly OPEN = OPEN;

  readyState: number = CONNECTING;

  private url: string;
  private listeners: Map<string, Set<EventSourceListener>> = new Map();
  private abortController: AbortController;
  private lastEventId: string = '';

  constructor(url: string, _eventSourceInitDict?: { withCredentials?: boolean }) {
    this.url = url;
    this.abortController = new AbortController();
    this.connect();
  }

  private async connect() {
    try {
      const response = await fetch(this.url, {
        method: 'GET',
        headers: {
          accept: 'text/event-stream',
          ...(this.lastEventId ? { 'last-event-id': this.lastEventId } : {}),
        },
        signal: this.abortController.signal,
      });

      if (!response.ok || !response.body) {
        this.dispatchEvent('error', {});
        this.readyState = CLOSED;
        return;
      }

      this.readyState = OPEN;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line (\n\n)
        let separatorIndex: number;
        while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          this.processEvent(rawEvent);
        }
      }

      // Connection closed by server
      this.readyState = CLOSED;
      this.dispatchEvent('error', {});
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      this.readyState = CLOSED;
      this.dispatchEvent('error', {});
    }
  }

  private processEvent(rawEvent: string) {
    let eventField = 'message';
    let dataLines: string[] = [];
    let idField: string | undefined;

    const lines = rawEvent.split('\n');
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventField = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^ /, ''));
      } else if (line.startsWith('id:')) {
        idField = line.slice(3).trim();
        if (idField) {
          this.lastEventId = idField;
        }
      }
      // Ignore comment lines (starting with ':') and retry lines
    }

    const data = dataLines.join('\n');
    const messageEvent: PolyfillMessageEvent = {
      data,
      lastEventId: idField,
    };

    this.dispatchEvent(eventField, messageEvent);
  }

  private dispatchEvent(type: string, event: Partial<PolyfillMessageEvent>) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event as Event);
        } catch {
          // ignore listener errors
        }
      }
    }
  }

  addEventListener(type: string, listener: EventSourceListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventSourceListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.abortController.abort();
    this.readyState = CLOSED;
  }
}

export { PolyfillEventSource as EventSource };