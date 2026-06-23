import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import { writeFile } from 'fs/promises';
import type { AppRouter } from './server';

class NodeEventSource extends EventTarget {
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;

  readyState = this.CONNECTING;
  url: string;
  withCredentials = false;

  #abortController = new AbortController();

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    void this.#connect();
  }

  close() {
    this.readyState = this.CLOSED;
    this.#abortController.abort();
  }

  async #connect() {
    try {
      const response = await fetch(this.url, {
        headers: {
          accept: 'text/event-stream',
        },
        signal: this.#abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE request failed with status ${response.status}`);
      }

      this.readyState = this.OPEN;
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += value;

        while (true) {
          const boundaryIndex = buffer.indexOf('\n\n');
          if (boundaryIndex === -1) break;

          const rawEvent = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + 2);
          this.#dispatchEvent(rawEvent);
        }
      }

      this.close();
    } catch (error) {
      if (this.#abortController.signal.aborted) {
        return;
      }

      this.readyState = this.CLOSED;
      const event = new Event('error');
      this.dispatchEvent(event);
      const onerror = (this as NodeEventSource & { onerror?: (event: Event) => void }).onerror;
      onerror?.(event);
      console.error(error);
    }
  }

  #dispatchEvent(rawEvent: string) {
    const lines = rawEvent.split(/\r?\n/);
    let eventName = 'message';
    let data = '';
    let lastEventId = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        data += `${line.slice(5).trimStart()}\n`;
      } else if (line.startsWith('id:')) {
        lastEventId = line.slice(3).trim();
      }
    }

    const messageEvent = new MessageEvent(eventName, {
      data: data.endsWith('\n') ? data.slice(0, -1) : data,
      lastEventId,
      origin: new URL(this.url).origin,
    });

    this.dispatchEvent(messageEvent);
  }
}

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
      EventSource: NodeEventSource as never,
    }),
  ],
});

async function main() {
  const values: number[] = [];

  await new Promise<void>((resolve, reject) => {
    client.countdown.subscribe(3, {
      onData(value) {
        values.push(value);
      },
      onError(error) {
        reject(error);
      },
      async onComplete() {
        try {
          await writeFile('/home/user/project/output.json', JSON.stringify(values));
          resolve();
        } catch (error) {
          reject(error);
        }
      },
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
