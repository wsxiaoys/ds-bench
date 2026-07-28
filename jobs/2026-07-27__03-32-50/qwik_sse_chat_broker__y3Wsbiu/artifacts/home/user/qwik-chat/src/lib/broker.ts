import type { ChatMessage } from "./db";

type Listener = (message: ChatMessage) => void;

/**
 * A simple in-memory pub/sub broker, scoped per room. This is the only
 * fan-out mechanism used to deliver newly published messages to live SSE
 * subscribers; it never touches the network or any external service.
 */
class RoomBroker {
  private rooms = new Map<string, Set<Listener>>();

  subscribe(room: string, listener: Listener): () => void {
    let set = this.rooms.get(room);
    if (!set) {
      set = new Set();
      this.rooms.set(room, set);
    }
    set.add(listener);

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      const current = this.rooms.get(room);
      if (current) {
        current.delete(listener);
        if (current.size === 0) {
          this.rooms.delete(room);
        }
      }
    };
  }

  publish(room: string, message: ChatMessage): void {
    const set = this.rooms.get(room);
    if (!set || set.size === 0) return;
    // Snapshot the listeners so that a listener unsubscribing mid-publish
    // (e.g. due to a write error) can't corrupt iteration.
    for (const listener of Array.from(set)) {
      try {
        listener(message);
      } catch {
        // Listeners must handle their own errors; ignore here to keep
        // delivery to other subscribers unaffected.
      }
    }
  }

  subscriberCount(room: string): number {
    return this.rooms.get(room)?.size ?? 0;
  }
}

export const broker = new RoomBroker();
