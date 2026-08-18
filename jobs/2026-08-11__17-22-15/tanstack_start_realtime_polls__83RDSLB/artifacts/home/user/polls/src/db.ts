import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import crypto from 'crypto'

let db: Database | null = null

export async function getDb() {
  if (db) return db
  
  db = await open({
    filename: './polls.db',
    driver: sqlite3.Database
  })
  
  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON')
  
  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      option_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (poll_id, client_id)
    );
  `)
  
  return db
}

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

export async function createPoll(question: string, optionTexts: string[]): Promise<Poll> {
  const database = await getDb()
  const pollId = crypto.randomUUID()
  
  await database.run('INSERT INTO polls (id, question) VALUES (?, ?)', pollId, question)
  
  const options: Option[] = []
  for (const text of optionTexts) {
    const optionId = crypto.randomUUID()
    await database.run(
      'INSERT INTO options (id, poll_id, text, votes) VALUES (?, ?, ?, 0)',
      optionId,
      pollId,
      text
    )
    options.push({ id: optionId, text, votes: 0 })
  }
  
  return {
    id: pollId,
    question,
    totalVotes: 0,
    options
  }
}

export async function getPoll(id: string): Promise<Poll | null> {
  const database = await getDb()
  
  const pollRow = await database.get('SELECT * FROM polls WHERE id = ?', id)
  if (!pollRow) return null
  
  const optionRows = await database.all('SELECT * FROM options WHERE poll_id = ?', id)
  
  let totalVotes = 0
  const options = optionRows.map((row: any) => {
    totalVotes += row.votes
    return {
      id: row.id,
      text: row.text,
      votes: row.votes
    }
  })
  
  return {
    id: pollRow.id,
    question: pollRow.question,
    totalVotes,
    options
  }
}

export async function listAllPolls(): Promise<Poll[]> {
  const database = await getDb()
  const pollRows = await database.all('SELECT * FROM polls ORDER BY created_at DESC')
  
  const polls: Poll[] = []
  for (const p of pollRows) {
    const optionRows = await database.all('SELECT * FROM options WHERE poll_id = ?', p.id)
    let totalVotes = 0
    const options = optionRows.map((row: any) => {
      totalVotes += row.votes
      return {
        id: row.id,
        text: row.text,
        votes: row.votes
      }
    })
    polls.push({
      id: p.id,
      question: p.question,
      totalVotes,
      options
    })
  }
  return polls
}

export async function castVote(pollId: string, optionId: string, clientId: string): Promise<Poll> {
  const database = await getDb()
  
  // Verify poll exists
  const poll = await getPoll(pollId)
  if (!poll) {
    throw new Error('POLL_NOT_FOUND')
  }
  
  // Verify option exists
  const optionExists = poll.options.some(o => o.id === optionId)
  if (!optionExists) {
    throw new Error('OPTION_NOT_FOUND')
  }
  
  // Run in transaction for atomicity
  await database.run('BEGIN TRANSACTION')
  try {
    // Check if client already voted on this poll
    const existingVote = await database.get(
      'SELECT 1 FROM votes WHERE poll_id = ? AND client_id = ?',
      pollId,
      clientId
    )
    if (existingVote) {
      throw new Error('ALREADY_VOTED')
    }
    
    // Record vote
    await database.run(
      'INSERT INTO votes (poll_id, client_id, option_id) VALUES (?, ?, ?)',
      pollId,
      clientId,
      optionId
    )
    
    // Increment option vote count
    await database.run(
      'UPDATE options SET votes = votes + 1 WHERE id = ? AND poll_id = ?',
      optionId,
      pollId
    )
    
    await database.run('COMMIT')
  } catch (err) {
    await database.run('ROLLBACK')
    throw err
  }
  
  const updatedPoll = await getPoll(pollId)
  if (!updatedPoll) {
    throw new Error('POLL_NOT_FOUND')
  }
  return updatedPoll
}

export async function hasClientVoted(pollId: string, clientId: string): Promise<boolean> {
  const database = await getDb()
  const existingVote = await database.get(
    'SELECT 1 FROM votes WHERE poll_id = ? AND client_id = ?',
    pollId,
    clientId
  )
  return !!existingVote
}
