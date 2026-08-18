import Database from "better-sqlite3";
import path from "path";

export interface Message {
  room: string;
  seq: number;
  user: string;
  text: string;
  ts: number;
}

type Listener = (msg: Message) => void;

class Broker {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(room: string, listener: Listener): () => void {
    if (!this.listeners.has(room)) {
      this.listeners.set(room, new Set());
    }
    this.listeners.get(room)!.add(listener);

    return () => {
      const roomListeners = this.listeners.get(room);
      if (roomListeners) {
        roomListeners.delete(listener);
        if (roomListeners.size === 0) {
          this.listeners.delete(room);
        }
      }
    };
  }

  publish(room: string, msg: Message) {
    const roomListeners = this.listeners.get(room);
    if (roomListeners) {
      for (const listener of roomListeners) {
        try {
          listener(msg);
        } catch (err) {
          console.error("Error in listener:", err);
        }
      }
    }
  }

  getSubscriberCount(room: string): number {
    return this.listeners.get(room)?.size || 0;
  }
}

// Support hot-reloading in Vite without losing DB connection or broker state
const globalObj = globalThis as any;

if (!globalObj.__db) {
  const dbPath = path.join(process.cwd(), "chat.db");
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      room TEXT,
      seq INTEGER,
      user TEXT,
      text TEXT,
      ts INTEGER,
      PRIMARY KEY (room, seq)
    );
    CREATE INDEX IF NOT EXISTS idx_messages_room_seq ON messages (room, seq);
  `);
  globalObj.__db = db;
}

if (!globalObj.__broker) {
  globalObj.__broker = new Broker();
}

export const db = globalObj.__db as any;
export const broker = globalObj.__broker as Broker;
