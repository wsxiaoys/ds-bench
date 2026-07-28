import Database from "better-sqlite3";
import path from "path";

export interface Message {
  room: string;
  seq: number;
  user: string;
  text: string;
  ts: number;
}

export interface Subscriber {
  id: string;
  room: string;
  send: (msg: Message) => void;
  queue: Message[];
  isReplaying: boolean;
  highestSentSeq: number;
}

class Broker {
  private rooms = new Map<string, Map<string, Subscriber>>();

  subscribe(room: string, sub: Subscriber) {
    let subs = this.rooms.get(room);
    if (!subs) {
      subs = new Map();
      this.rooms.set(room, subs);
    }
    subs.set(sub.id, sub);
  }

  unsubscribe(room: string, sub: Subscriber) {
    const subs = this.rooms.get(room);
    if (subs) {
      subs.delete(sub.id);
      if (subs.size === 0) {
        this.rooms.delete(room);
      }
    }
  }

  publish(room: string, msg: Message) {
    const subs = this.rooms.get(room);
    if (subs) {
      for (const sub of subs.values()) {
        sub.send(msg);
      }
    }
  }

  getPresence(room: string): number {
    const subs = this.rooms.get(room);
    return subs ? subs.size : 0;
  }
}

interface GlobalState {
  _db?: Database.Database;
  _broker?: Broker;
}

const g = globalThis as unknown as GlobalState;

if (!g._db) {
  const dbPath = path.join(process.cwd(), "chat.db");
  g._db = new Database(dbPath);

  // Initialize table and index
  g._db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      room TEXT NOT NULL,
      seq INTEGER NOT NULL,
      user TEXT NOT NULL,
      text TEXT NOT NULL,
      ts INTEGER NOT NULL,
      PRIMARY KEY (room, seq)
    );
    CREATE INDEX IF NOT EXISTS idx_messages_room_seq ON messages (room, seq);
  `);
}

if (!g._broker) {
  g._broker = new Broker();
}

export const db = g._db;
export const broker = g._broker;
