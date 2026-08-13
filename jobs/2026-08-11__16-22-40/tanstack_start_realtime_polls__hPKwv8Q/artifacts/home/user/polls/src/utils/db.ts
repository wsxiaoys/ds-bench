import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'

const db = new DatabaseSync('/home/user/polls/polls.db')

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;')

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS options (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL,
    text TEXT NOT NULL,
    votes INTEGER DEFAULT 0,
    FOREIGN KEY(poll_id) REFERENCES polls(id) ON DELETE CASCADE
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS votes (
    poll_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    PRIMARY KEY(poll_id, client_id)
  );
`)

export interface Option {
  id: string
  text: string
  votes: number
}

export interface Poll {
  id: string
  question: string
  totalVotes: number
  options: Option[]
}

export function createPoll(question: string, optionTexts: string[]): Poll {
  const pollId = crypto.randomUUID()
  
  // Start transaction
  db.exec('BEGIN TRANSACTION;')
  try {
    const insertPoll = db.prepare('INSERT INTO polls (id, question) VALUES (?, ?)')
    insertPoll.run(pollId, question)

    const insertOption = db.prepare('INSERT INTO options (id, poll_id, text, votes) VALUES (?, ?, ?, 0)')
    for (const text of optionTexts) {
      const optionId = crypto.randomUUID()
      insertOption.run(optionId, pollId, text)
    }
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }

  return getPoll(pollId)!
}

export function getPoll(id: string): Poll | null {
  const pollRow = db.prepare('SELECT * FROM polls WHERE id = ?').get(id) as { id: string, question: string } | undefined
  if (!pollRow) {
    return null
  }

  const optionRows = db.prepare('SELECT * FROM options WHERE poll_id = ?').all(id) as { id: string, text: string, votes: number }[]
  
  let totalVotes = 0
  const options: Option[] = []
  for (const row of optionRows) {
    totalVotes += row.votes
    options.push({
      id: row.id,
      text: row.text,
      votes: row.votes
    })
  }

  return {
    id: pollRow.id,
    question: pollRow.question,
    totalVotes,
    options
  }
}

export function listPolls(): Poll[] {
  const pollRows = db.prepare('SELECT * FROM polls').all() as { id: string, question: string }[]
  const polls: Poll[] = []

  for (const pollRow of pollRows) {
    const optionRows = db.prepare('SELECT * FROM options WHERE poll_id = ?').all(pollRow.id) as { id: string, text: string, votes: number }[]
    let totalVotes = 0
    const options: Option[] = []
    for (const row of optionRows) {
      totalVotes += row.votes
      options.push({
        id: row.id,
        text: row.text,
        votes: row.votes
      })
    }
    polls.push({
      id: pollRow.id,
      question: pollRow.question,
      totalVotes,
      options
    })
  }

  return polls
}

export interface VoteResult {
  success: boolean
  status: 200 | 404 | 409
  error?: string
  poll?: Poll
}

export function castVote(pollId: string, optionId: string, clientId: string): VoteResult {
  // Check if poll exists
  const poll = getPoll(pollId)
  if (!poll) {
    return { success: false, status: 404, error: 'Poll not found' }
  }

  // Check if option exists and belongs to the poll
  const option = poll.options.find(o => o.id === optionId)
  if (!option) {
    return { success: false, status: 404, error: 'Option not found' }
  }

  // Start transaction
  db.exec('BEGIN TRANSACTION;')
  try {
    // Check if client has already voted
    const existingVote = db.prepare('SELECT 1 FROM votes WHERE poll_id = ? AND client_id = ?').get(pollId, clientId)
    if (existingVote) {
      db.exec('ROLLBACK;')
      return { success: false, status: 409, error: 'You have already voted on this poll' }
    }

    // Record the vote
    db.prepare('INSERT INTO votes (poll_id, client_id) VALUES (?, ?)').run(pollId, clientId)

    // Increment option vote count
    db.prepare('UPDATE options SET votes = votes + 1 WHERE id = ? AND poll_id = ?').run(optionId, pollId)

    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    return { success: false, status: 409, error: 'Voting failed due to concurrent update' }
  }

  // Get the updated poll
  const updatedPoll = getPoll(pollId)!
  return { success: true, status: 200, poll: updatedPoll }
}
