import type { Message } from './types';

export class Subscriber {
  readonly id: string;
  readonly room: string;
  private writer: any; // Use any to avoid type issues with different WritableStream versions
  private encoder = new TextEncoder();
  private queue: Message[] = [];
  private highestSentSeq: number = 0;
  private isLive = false;
  private isClosed = false;

  constructor(id: string, room: string, writer: any, initialSeq: number) {
    this.id = id;
    this.room = room;
    this.writer = writer;
    this.highestSentSeq = initialSeq;
  }

  // Called by the broker when a new message is published
  public handleMessage(message: Message) {
    if (this.isClosed) return;

    if (this.isLive) {
      this.sendOrQueue(message);
    } else {
      this.queue.push(message);
    }
  }

  private async sendOrQueue(message: Message) {
    if (message.seq <= this.highestSentSeq) {
      return; // Skip duplicate
    }
    this.highestSentSeq = message.seq;
    try {
      const sseString = `id: ${message.seq}\nevent: message\ndata: ${JSON.stringify({
        room: message.room,
        seq: message.seq,
        user: message.user,
        text: message.text,
        ts: message.ts
      })}\n\n`;
      await this.writer.write(this.encoder.encode(sseString));
    } catch (err) {
      // Stream might be closed or aborted
    }
  }

  // Called after replay messages have been sent
  public async transitionToLive(replayMessages: Message[]) {
    // 1. Send all replay messages
    for (const msg of replayMessages) {
      await this.sendOrQueue(msg);
    }

    // 2. Mark as live
    this.isLive = true;

    // 3. Drain queue
    const pending = this.queue;
    this.queue = [];
    for (const msg of pending) {
      await this.sendOrQueue(msg);
    }
  }

  public close() {
    if (this.isClosed) return;
    this.isClosed = true;
    try {
      this.writer.releaseLock();
    } catch (err) {
      // Ignore
    }
  }
}
