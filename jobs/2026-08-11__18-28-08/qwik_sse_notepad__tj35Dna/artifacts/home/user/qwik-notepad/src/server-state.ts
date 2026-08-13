import type { WritableStreamDefaultWriter } from 'node:stream/web';

export interface Subscriber {
  id: string;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  sendUpdate: (text: string, version: number) => Promise<boolean>;
}

class ServerState {
  private text: string = "";
  private version: number = 0;
  private subscribers: Map<string, Subscriber> = new Map();

  public getDoc() {
    return {
      text: this.text,
      version: this.version,
    };
  }

  public updateDoc(newText: string): { text: string; version: number } {
    this.version += 1;
    this.text = newText;
    
    const currentText = this.text;
    const currentVersion = this.version;
    
    // Broadcast to all subscribers
    for (const [id, sub] of this.subscribers.entries()) {
      sub.sendUpdate(currentText, currentVersion).catch(() => {
        this.removeSubscriber(id);
      });
    }

    return {
      text: currentText,
      version: currentVersion,
    };
  }

  public addSubscriber(sub: Subscriber) {
    this.subscribers.set(sub.id, sub);
  }

  public removeSubscriber(id: string) {
    const sub = this.subscribers.get(id);
    if (sub) {
      this.subscribers.delete(id);
      try {
        sub.writer.close().catch(() => {});
      } catch (e) {}
    }
  }

  public getSubscriberCount(): number {
    return this.subscribers.size;
  }
}

export const serverState = new ServerState();

export function formatSSE(text: string, version: number): string {
  const lines = text.split('\n');
  const dataLines = lines.map(line => `data: ${line}`).join('\n');
  return `event: update\nid: ${version}\n${dataLines}\n\n`;
}
