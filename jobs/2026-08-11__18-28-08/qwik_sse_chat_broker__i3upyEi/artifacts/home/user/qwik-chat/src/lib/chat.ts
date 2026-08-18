import Database from 'better-sqlite3';
import path from 'path';

// Resolve the database path in the project directory
const dbPath = path.join(process.cwd(), 'chat.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance and concurrency
db.pragma('journal_mode = WAL');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    room TEXT NOT NULL,
    seq INTEGER NOT NULL,
    user TEXT NOT NULL,
    text TEXT NOT NULL,
    ts INTEGER NOT NULL,
    PRIMARY KEY (room, seq)
  );
`);

export interface Message {
  room: string;
  seq: number;
  user: string;
  text: string;
  ts: number;
}

// In-memory active subscribers registry
// Map from room name to a Set of callback functions
type MessageCallback = (msg: Message) => void;
const subscribers = new Map<string, Set<MessageCallback>>();

export function subscribe(room: string, callback: MessageCallback): () => void {
  if (!subscribers.has(room)) {
    subscribers.set(room, new Set());
  }
  subscribers.get(room)!.add(callback);

  // Return unsubscribe function
  return () => {
    const roomSubs = subscribers.get(room);
    if (roomSubs) {
      roomSubs.delete(callback);
      if (roomSubs.size === 0) {
        subscribers.delete(room);
      }
    }
  };
}

export function getSubscriberCount(room: string): number {
  return subscribers.get(room)?.size ?? 0;
}

export function publishMessage(room: string, user: string, text: string): Message {
  const ts = Date.now();

  // Run SQLite transaction to get next seq and insert message atomically
  const msg = db.transaction(() => {
    const row = db.prepare('SELECT COALESCE(MAX(seq), 0) as maxSeq FROM messages WHERE room = ?').get(room) as { maxSeq: number } | undefined;
    const nextSeq = (row?.maxSeq ?? 0) + 1;

    db.prepare('INSERT INTO messages (room, seq, user, text, ts) VALUES (?, ?, ?, ?, ?)')
      .run(room, nextSeq, user, text, ts);

    return {
      room,
      seq: nextSeq,
      user,
      text,
      ts
    };
  })();

  // Fan-out to active subscribers of this room
  const roomSubs = subscribers.get(room);
  if (roomSubs) {
    for (const callback of roomSubs) {
      try {
        callback(msg);
      } catch (err) {
        console.error('Error in subscriber callback:', err);
      }
    }
  }

  return msg;
}

export function getMessagesAfter(room: string, seq: number): Message[] {
  return db.prepare('SELECT room, seq, user, text, ts FROM messages WHERE room = ? AND seq > ? ORDER BY seq ASC')
    .all(room, seq) as Message[];
}

export function getRecentMessages(room: string, limit = 50): Message[] {
  const rows = db.prepare('SELECT room, seq, user, text, ts FROM messages WHERE room = ? ORDER BY seq DESC LIMIT ?')
    .all(room, limit) as Message[];
  return rows.reverse();
}
