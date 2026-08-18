import type { Subscriber } from './subscriber';
import type { Message } from './types';

export class Broker {
  private rooms = new Map<string, Set<Subscriber>>();

  public getSubscriberCount(room: string): number {
    return this.rooms.get(room)?.size ?? 0;
  }

  public subscribe(room: string, subscriber: Subscriber) {
    let subs = this.rooms.get(room);
    if (!subs) {
      subs = new Set();
      this.rooms.set(room, subs);
    }
    subs.add(subscriber);
  }

  public unsubscribe(room: string, subscriber: Subscriber) {
    const subs = this.rooms.get(room);
    if (subs) {
      subs.delete(subscriber);
      if (subs.size === 0) {
        this.rooms.delete(room);
      }
    }
    subscriber.close();
  }

  public publish(message: Message) {
    const subs = this.rooms.get(message.room);
    if (subs) {
      for (const sub of subs) {
        sub.handleMessage(message);
      }
    }
  }
}

const globalInit = globalThis as any;

if (!globalInit.broker) {
  globalInit.broker = new Broker();
}

export const broker = globalInit.broker as Broker;
