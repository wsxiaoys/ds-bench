import Database from 'better-sqlite3';

const db = new Database('/home/user/qwik-app/poll.db', { timeout: 5000 });

// Enable Write-Ahead Logging (WAL) mode for better concurrency
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

export interface VoteResult {
  success: boolean;
  error?: 'poll_not_found' | 'option_not_found' | 'rate_limited';
  votes?: Record<string, number>;
}

export function getPoll(id: string): Poll | null {
  const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(id) as Poll | undefined;
  return poll || null;
}

export function getOptions(pollId: string): Option[] {
  return db.prepare('SELECT * FROM options WHERE poll_id = ?').all(pollId) as Option[];
}

export const castVoteTx = db.transaction((pollId: string, optionId: number, ip: string, now: number): VoteResult => {
  // 1. Check if the poll exists
  const poll = db.prepare('SELECT 1 FROM polls WHERE id = ?').get(pollId);
  if (!poll) {
    return { success: false, error: 'poll_not_found' };
  }

  // 2. Check if the option exists and belongs to the poll
  const option = db.prepare('SELECT 1 FROM options WHERE id = ? AND poll_id = ?').get(optionId, pollId);
  if (!option) {
    return { success: false, error: 'option_not_found' };
  }

  // 3. Rate limiting check: 1 vote per 5 seconds per poll per IP
  const fiveSecAgo = now - 5000;
  const recentVote = db.prepare(
    'SELECT 1 FROM votes_log WHERE poll_id = ? AND ip = ? AND timestamp >= ?'
  ).get(pollId, ip, fiveSecAgo);

  if (recentVote) {
    return { success: false, error: 'rate_limited' };
  }

  // 4. Insert into votes_log
  db.prepare('INSERT INTO votes_log (poll_id, ip, timestamp) VALUES (?, ?, ?)').run(pollId, ip, now);

  // 5. Increment vote count atomically
  db.prepare('UPDATE options SET votes = votes + 1 WHERE id = ?').run(optionId);

  // 6. Get updated votes
  const updatedOptions = db.prepare('SELECT id, votes FROM options WHERE poll_id = ?').all(pollId) as Option[];
  
  const votes: Record<string, number> = {};
  for (const opt of updatedOptions) {
    votes[String(opt.id)] = opt.votes;
  }

  return { success: true, votes };
});

export default db;
