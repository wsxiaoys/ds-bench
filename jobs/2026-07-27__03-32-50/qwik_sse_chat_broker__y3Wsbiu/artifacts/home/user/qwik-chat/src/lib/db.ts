import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export interface ChatMessage {
  room: string;
  seq: number;
  user: string;
  text: string;
  ts: number;
}

const DB_PATH = join(process.cwd(), "data", "chat.db");

function ensureDir(path: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

ensureDir(DB_PATH);

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

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

const getMaxSeqStmt = db.prepare<[string], { maxSeq: number | null }>(
  "SELECT MAX(seq) AS maxSeq FROM messages WHERE room = ?",
);

const insertStmt = db.prepare<
  { room: string; seq: number; user: string; text: string; ts: number },
  unknown
>(
  "INSERT INTO messages (room, seq, user, text, ts) VALUES (@room, @seq, @user, @text, @ts)",
);

/**
 * Atomically assigns the next sequence number for a room, and persists the
 * message. Because better-sqlite3 executes synchronously and this whole
 * function runs inside a single DB transaction, no interleaving with other
 * concurrent requests can occur, guaranteeing gapless, unique, monotonically
 * increasing sequence numbers per room even under heavy concurrency.
 */
const insertMessageTx = db.transaction(
  (room: string, user: string, text: string, ts: number): ChatMessage => {
    const row = getMaxSeqStmt.get(room);
    const nextSeq = row && typeof row.maxSeq === "number" ? row.maxSeq + 1 : 1;
    insertStmt.run({ room, seq: nextSeq, user, text, ts });
    return { room, seq: nextSeq, user, text, ts };
  },
);

export function insertMessage(
  room: string,
  user: string,
  text: string,
  ts: number,
): ChatMessage {
  return insertMessageTx(room, user, text, ts);
}

const getRecentStmt = db.prepare<[string, number], ChatMessage>(
  "SELECT room, seq, user, text, ts FROM messages WHERE room = ? ORDER BY seq DESC LIMIT ?",
);

/** Returns the most recent `limit` messages for a room, in ascending seq order. */
export function getRecentMessages(room: string, limit: number): ChatMessage[] {
  const rows = getRecentStmt.all(room, limit);
  return rows.reverse();
}

const getAfterStmt = db.prepare<[string, number], ChatMessage>(
  "SELECT room, seq, user, text, ts FROM messages WHERE room = ? AND seq > ? ORDER BY seq ASC",
);

/** Returns all messages for a room with seq strictly greater than `afterSeq`, in ascending order. */
export function getMessagesAfter(room: string, afterSeq: number): ChatMessage[] {
  return getAfterStmt.all(room, afterSeq);
}

export default db;
