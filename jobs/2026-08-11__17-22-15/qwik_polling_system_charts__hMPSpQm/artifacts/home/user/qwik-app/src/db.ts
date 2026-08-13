import Database from 'better-sqlite3';

const dbPath = '/home/user/qwik-app/poll.db';

export const db = new Database(dbPath, { timeout: 5000 });
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

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

export function getPollWithOptions(pollId: string): { poll: Poll; options: Option[] } | null {
  try {
    const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId) as Poll | undefined;
    if (!poll) {
      return null;
    }
    const options = db.prepare('SELECT * FROM options WHERE poll_id = ?').all(pollId) as Option[];
    return { poll, options };
  } catch (err) {
    console.error('Error fetching poll with options:', err);
    return null;
  }
}

export function castVote(
  pollId: string,
  optionId: number,
  ip: string
): { success: boolean; error?: string; status?: number; votes?: Record<string, number> } {
  const now = Date.now();
  const fiveSecondsAgo = now - 5000;

  try {
    const transaction = db.transaction(() => {
      // 1. Check if poll exists
      const poll = db.prepare('SELECT id FROM polls WHERE id = ?').get(pollId);
      if (!poll) {
        return { success: false, error: 'Poll or option not found', status: 404 };
      }

      // 2. Check if option exists and belongs to the poll
      const option = db.prepare('SELECT id FROM options WHERE id = ? AND poll_id = ?').get(optionId, pollId);
      if (!option) {
        return { success: false, error: 'Poll or option not found', status: 404 };
      }

      // 3. Check rate limit
      const recentVote = db.prepare(
        'SELECT id FROM votes_log WHERE poll_id = ? AND ip = ? AND timestamp > ? LIMIT 1'
      ).get(pollId, ip, fiveSecondsAgo);

      if (recentVote) {
        return { success: false, error: 'Rate limit exceeded', status: 429 };
      }

      // 4. Log the vote
      db.prepare('INSERT INTO votes_log (poll_id, ip, timestamp) VALUES (?, ?, ?)').run(pollId, ip, now);

      // 5. Increment vote count
      db.prepare('UPDATE options SET votes = votes + 1 WHERE id = ? AND poll_id = ?').run(optionId, pollId);

      // 6. Fetch all options for this poll to return updated votes
      const options = db.prepare('SELECT id, votes FROM options WHERE poll_id = ?').all(pollId) as { id: number; votes: number }[];
      const votes: Record<string, number> = {};
      for (const opt of options) {
        votes[String(opt.id)] = opt.votes;
      }

      return { success: true, votes };
    });

    return transaction();
  } catch (err: any) {
    console.error('Database transaction error:', err);
    return { success: false, error: 'Internal server error', status: 500 };
  }
}
