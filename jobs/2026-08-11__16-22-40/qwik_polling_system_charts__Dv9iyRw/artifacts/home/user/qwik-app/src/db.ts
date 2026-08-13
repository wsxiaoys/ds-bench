import Database from 'better-sqlite3';

const dbPath = '/home/user/qwik-app/poll.db';
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

export interface Poll {
  id: string;
  question: string;
}

export interface Option {
  id: number;
  poll_id: string;
  text: string;
  votes: number;
}

export interface VoteLog {
  id: number;
  poll_id: string;
  ip: string;
  timestamp: number;
}

export function getPoll(pollId: string): Poll | undefined {
  return db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId) as Poll | undefined;
}

export function getOptions(pollId: string): Option[] {
  return db.prepare('SELECT * FROM options WHERE poll_id = ?').all(pollId) as Option[];
}

export const castVoteTransaction = db.transaction((pollId: string, optionId: number, ip: string, now: number) => {
  // 1. Enforce rate limit (1 vote per 5 seconds per poll per IP)
  const lastVote = db.prepare(
    'SELECT timestamp FROM votes_log WHERE poll_id = ? AND ip = ? ORDER BY timestamp DESC LIMIT 1'
  ).get(pollId, ip) as { timestamp: number } | undefined;

  if (lastVote && (now - lastVote.timestamp) < 5000) {
    return { error: 'rate_limit' };
  }

  // 2. Verify that the option exists and belongs to this poll
  const option = db.prepare(
    'SELECT id FROM options WHERE id = ? AND poll_id = ?'
  ).get(optionId, pollId);

  if (!option) {
    return { error: 'not_found' };
  }

  // 3. Insert into votes_log
  db.prepare(
    'INSERT INTO votes_log (poll_id, ip, timestamp) VALUES (?, ?, ?)'
  ).run(pollId, ip, now);

  // 4. Increment vote count
  db.prepare(
    'UPDATE options SET votes = votes + 1 WHERE id = ?'
  ).run(optionId);

  return { success: true };
});

export default db;
