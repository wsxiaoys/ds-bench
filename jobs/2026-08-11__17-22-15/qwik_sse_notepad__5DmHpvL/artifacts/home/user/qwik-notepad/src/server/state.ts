export interface Subscriber {
  id: string;
  send: (msg: string) => Promise<boolean>;
}

class DocumentState {
  private version: number = 0;
  private text: string = "";
  private subscribers: Map<string, Subscriber> = new Map();

  getVersion() {
    return this.version;
  }

  getText() {
    return this.text;
  }

  getSubscriberCount() {
    return this.subscribers.size;
  }

  addSubscriber(id: string, subscriber: Subscriber) {
    this.subscribers.set(id, subscriber);
  }

  removeSubscriber(id: string) {
    this.subscribers.delete(id);
  }

  // Atomically apply an edit and broadcast to all subscribers
  updateDocument(newText: string) {
    this.version += 1;
    this.text = newText;
    
    // Broadcast to all subscribers
    const sseMessage = this.formatSSEUpdate(this.version, this.text);
    for (const [id, sub] of this.subscribers.entries()) {
      sub.send(sseMessage).catch((err) => {
        // If sending fails, remove the subscriber
        this.removeSubscriber(id);
      });
    }
    return { version: this.version, text: this.text };
  }

  formatSSEUpdate(version: number, text: string): string {
    const lines = text.split('\n');
    let sse = `event: update\nid: ${version}\n`;
    for (const line of lines) {
      sse += `data: ${line}\n`;
    }
    sse += `\n`;
    return sse;
  }
}

export const docState = new DocumentState();
