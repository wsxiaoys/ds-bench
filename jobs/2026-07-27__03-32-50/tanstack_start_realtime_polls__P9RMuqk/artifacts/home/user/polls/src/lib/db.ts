import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type PollOption = { id: string; text: string; votes: number };
export type Poll = {
  id: string;
  question: string;
  totalVotes: number;
  options: PollOption[];
};

type PollRow = { id: string; question: string; created_at: number };
type OptionRow = {
  id: string;
  poll_id: string;
  text: string;
  votes: number;
  position: number;
};

let dbInstance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "polls.db");

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS options (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL,
      text TEXT NOT NULL,
      votes INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS poll_votes (
      poll_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      option_id TEXT NOT NULL,
      PRIMARY KEY (poll_id, client_id)
    );
  `);

  dbInstance = db;
  return db;
}

function rowsToPoll(pollRow: PollRow, optionRows: OptionRow[]): Poll {
  const options = optionRows.map((o) => ({
    id: o.id,
    text: o.text,
    votes: o.votes,
  }));
  const totalVotes = options.reduce((sum, o) => sum + o.votes, 0);
  return { id: pollRow.id, question: pollRow.question, totalVotes, options };
}

export function createPoll(question: string, optionTexts: string[]): Poll {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  db.exec("BEGIN");
  try {
    db.prepare(
      "INSERT INTO polls (id, question, created_at) VALUES (?, ?, ?)",
    ).run(id, question, now);

    const insertOption = db.prepare(
      "INSERT INTO options (id, poll_id, text, votes, position) VALUES (?, ?, ?, 0, ?)",
    );
    optionTexts.forEach((text, index) => {
      insertOption.run(crypto.randomUUID(), id, text, index);
    });

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return getPollById(id)!;
}

export function getPollById(id: string): Poll | null {
  const db = getDb();
  const pollRow = db.prepare("SELECT * FROM polls WHERE id = ?").get(id) as
    | PollRow
    | undefined;
  if (!pollRow) return null;

  const optionRows = db
    .prepare("SELECT * FROM options WHERE poll_id = ? ORDER BY position ASC")
    .all(id) as OptionRow[];

  return rowsToPoll(pollRow, optionRows);
}

export function listPolls(): Poll[] {
  const db = getDb();
  const pollRows = db
    .prepare("SELECT * FROM polls ORDER BY created_at DESC")
    .all() as PollRow[];

  return pollRows.map((pollRow) => {
    const optionRows = db
      .prepare(
        "SELECT * FROM options WHERE poll_id = ? ORDER BY position ASC",
      )
      .all(pollRow.id) as OptionRow[];
    return rowsToPoll(pollRow, optionRows);
  });
}

export type VoteResult =
  | { ok: true; poll: Poll }
  | {
      ok: false;
      reason: "poll_not_found" | "option_not_found" | "already_voted";
    };

export function voteOnPoll(
  pollId: string,
  optionId: string,
  clientId: string,
): VoteResult {
  const db = getDb();

  const pollRow = db.prepare("SELECT * FROM polls WHERE id = ?").get(pollId) as
    | PollRow
    | undefined;
  if (!pollRow) return { ok: false, reason: "poll_not_found" };

  const optionRow = db
    .prepare("SELECT * FROM options WHERE id = ? AND poll_id = ?")
    .get(optionId, pollId) as OptionRow | undefined;
  if (!optionRow) return { ok: false, reason: "option_not_found" };

  db.exec("BEGIN IMMEDIATE");
  try {
    const existingVote = db
      .prepare(
        "SELECT 1 as found FROM poll_votes WHERE poll_id = ? AND client_id = ?",
      )
      .get(pollId, clientId);

    if (existingVote) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "already_voted" };
    }

    db.prepare(
      "INSERT INTO poll_votes (poll_id, client_id, option_id) VALUES (?, ?, ?)",
    ).run(pollId, clientId, optionId);
    db.prepare("UPDATE options SET votes = votes + 1 WHERE id = ?").run(
      optionId,
    );

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return { ok: true, poll: getPollById(pollId)! };
}
