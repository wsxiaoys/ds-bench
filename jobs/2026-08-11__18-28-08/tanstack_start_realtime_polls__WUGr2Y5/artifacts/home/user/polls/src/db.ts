import Database from 'better-sqlite3'
import { join } from 'path'

const dbPath = join(process.cwd(), 'polls.db')
const db = new Database(dbPath)

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS options (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL,
    text TEXT NOT NULL,
    votes INTEGER DEFAULT 0,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS votes (
    poll_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    PRIMARY KEY (poll_id, client_id)
  );
`)

export interface PollOption {
  id: string
  text: string
  votes: number
}

export interface Poll {
  id: string
  question: string
  totalVotes: number
  options: PollOption[]
}

export function getPoll(pollId: string): Poll | null {
  const pollRow = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId) as { id: string; question: string } | undefined
  if (!pollRow) return null

  const optionsRows = db.prepare('SELECT * FROM options WHERE poll_id = ?').all(pollId) as { id: string; text: string; votes: number }[]

  const totalVotesRow = db.prepare('SELECT SUM(votes) as total FROM options WHERE poll_id = ?').get(pollId) as { total: number | null }
  const totalVotes = totalVotesRow?.total || 0

  return {
    id: pollRow.id,
    question: pollRow.question,
    totalVotes,
    options: optionsRows.map(opt => ({
      id: opt.id,
      text: opt.text,
      votes: opt.votes
    }))
  }
}

export function createPoll(id: string, question: string, options: { id: string; text: string }[]): Poll {
  const insertPoll = db.prepare('INSERT INTO polls (id, question) VALUES (?, ?)')
  const insertOption = db.prepare('INSERT INTO options (id, poll_id, text, votes) VALUES (?, ?, ?, 0)')

  const runTx = db.transaction(() => {
    insertPoll.run(id, question)
    for (const opt of options) {
      insertOption.run(opt.id, id, opt.text)
    }
  })

  runTx()

  return {
    id,
    question,
    totalVotes: 0,
    options: options.map(opt => ({
      id: opt.id,
      text: opt.text,
      votes: 0
    }))
  }
}

export function listAllPolls(): Omit<Poll, 'options'>[] {
  const pollsRows = db.prepare('SELECT * FROM polls').all() as { id: string; question: string }[]
  return pollsRows.map(poll => {
    const totalVotesRow = db.prepare('SELECT SUM(votes) as total FROM options WHERE poll_id = ?').get(poll.id) as { total: number | null }
    return {
      id: poll.id,
      question: poll.question,
      totalVotes: totalVotesRow?.total || 0
    }
  })
}

export function hasVoted(pollId: string, clientId: string): boolean {
  const row = db.prepare('SELECT 1 FROM votes WHERE poll_id = ? AND client_id = ?').get(pollId, clientId)
  return !!row
}

export function castVote(pollId: string, optionId: string, clientId: string): Poll {
  const insertVote = db.prepare('INSERT INTO votes (poll_id, client_id) VALUES (?, ?)')
  const updateOption = db.prepare('UPDATE options SET votes = votes + 1 WHERE id = ? AND poll_id = ?')

  const runTx = db.transaction(() => {
    // Check if client already voted on this poll
    const existing = db.prepare('SELECT 1 FROM votes WHERE poll_id = ? AND client_id = ?').get(pollId, clientId)
    if (existing) {
      throw new Error('ALREADY_VOTED')
    }

    // Insert vote record
    insertVote.run(pollId, clientId)

    // Update option count
    const result = updateOption.run(optionId, pollId)
    if (result.changes === 0) {
      throw new Error('OPTION_NOT_FOUND')
    }
  })

  runTx()

  const updatedPoll = getPoll(pollId)
  if (!updatedPoll) {
    throw new Error('POLL_NOT_FOUND')
  }
  return updatedPoll
}

export default db
