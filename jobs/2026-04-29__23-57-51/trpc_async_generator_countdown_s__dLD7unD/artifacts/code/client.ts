import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import * as fs from 'fs';
import * as http from 'http';
import type { AppRouter } from './server';

// Minimal EventSource ponyfill for Node.js using the built-in http module.
// Implements the interface expected by tRPC's httpSubscriptionLink.
class NodeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;

  readyState: number = NodeEventSource.CONNECTING;

  private listeners: Map<string, Array<(event: any) => void>> = new Map();
  private req: http.ClientRequest | null = null;

  constructor(url: string, _initDict?: any) {
    this.connect(url);
  }

  private connect(url: string) {
    const parsed = new URL(url);
    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port) : 80,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    };

    this.req = http.request(options, (res) => {
      this.readyState = NodeEventSource.OPEN;
      this.emit('open', {});

      let buffer = '';

      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buffer += chunk;
        const parts = buffer.split('\n\n');
        // Keep the last (potentially incomplete) part in the buffer
        buffer = parts.pop() ?? '';

        for (const block of parts) {
          if (!block.trim()) continue;
          const eventObj: { data?: string; event?: string; id?: string } = {};

          for (const line of block.split('\n')) {
            if (line.startsWith('data:')) {
              eventObj.data = line.slice(5).trimStart();
            } else if (line.startsWith('event:')) {
              eventObj.event = line.slice(6).trimStart();
            } else if (line.startsWith('id:')) {
              eventObj.id = line.slice(3).trimStart();
            }
          }

          if (eventObj.data !== undefined) {
            const messageEvent = {
              data: eventObj.data,
              lastEventId: eventObj.id ?? '',
              type: eventObj.event ?? 'message',
            };
            this.emit(eventObj.event ?? 'message', messageEvent);
          }
        }
      });

      res.on('end', () => {
        this.readyState = NodeEventSource.CLOSED;
        this.emit('error', { type: 'error' });
      });

      res.on('error', (err: Error) => {
        this.readyState = NodeEventSource.CLOSED;
        this.emit('error', { type: 'error', message: err.message });
      });
    });

    this.req.on('error', (err: Error) => {
      this.readyState = NodeEventSource.CLOSED;
      this.emit('error', { type: 'error', message: err.message });
    });

    this.req.end();
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void): void {
    const arr = this.listeners.get(type);
    if (arr) {
      const idx = arr.indexOf(listener);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }

  private emit(type: string, event: any): void {
    const arr = this.listeners.get(type);
    if (arr) {
      for (const listener of arr) {
        listener(event);
      }
    }
  }

  close(): void {
    this.readyState = NodeEventSource.CLOSED;
    this.req?.destroy();
  }
}

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
      EventSource: NodeEventSource as any,
    }),
  ],
});

async function main() {
  const results: number[] = [];

  await new Promise<void>((resolve, reject) => {
    client.countdown.subscribe(5, {
      onData(value) {
        console.log('Received:', value);
        results.push(value);
      },
      onComplete() {
        resolve();
      },
      onError(err) {
        reject(err);
      },
    });
  });

  const outputPath = '/home/user/project/output.json';
  fs.writeFileSync(outputPath, JSON.stringify(results));
  console.log('Written to output.json:', results);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
