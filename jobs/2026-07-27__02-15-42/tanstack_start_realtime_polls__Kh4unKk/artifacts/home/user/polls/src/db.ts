import { createClient } from '@libsql/client'
import { v4 as uuidv4 } from 'uuid'

const db = createClient({
  url: 'file:local.db',
})

const initPromise = (async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      totalVotes INTEGER DEFAULT 0
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS options (
      id TEXT PRIMARY KEY,
      pollId TEXT NOT NULL,
      text TEXT NOT NULL,
      votes INTEGER DEFAULT 0,
      position INTEGER NOT NULL,
      FOREIGN KEY (pollId) REFERENCES polls(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS votes (
      pollId TEXT NOT NULL,
      clientId TEXT NOT NULL,
      PRIMARY KEY (pollId, clientId)
    )
  `)
})()

export async function getDb() {
  await initPromise
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
  const client = await getDb()
  const pollId = uuidv4()
  
  const tx = await client.transaction('write')
  try {
    await tx.execute({
      sql: 'INSERT INTO polls (id, question, totalVotes) VALUES (?, ?, 0)',
      args: [pollId, question]
    })

    const options: Option[] = []
    for (let i = 0; i < optionTexts.length; i++) {
      const optionId = uuidv4()
      const text = optionTexts[i]
      await tx.execute({
        sql: 'INSERT INTO options (id, pollId, text, votes, position) VALUES (?, ?, ?, 0, ?)',
        args: [optionId, pollId, text, i]
      })
      options.push({ id: optionId, text, votes: 0 })
    }

    await tx.commit()
    return {
      id: pollId,
      question,
      totalVotes: 0,
      options
    }
  } catch (err) {
    await tx.rollback()
    throw err
  }
}

export async function getPoll(id: string): Promise<Poll | null> {
  const client = await getDb()
  
  const pollRes = await client.execute({
    sql: 'SELECT * FROM polls WHERE id = ?',
    args: [id]
  })
  
  if (pollRes.rows.length === 0) {
    return null
  }
  
  const pollRow = pollRes.rows[0]
  
  const optionsRes = await client.execute({
    sql: 'SELECT id, text, votes FROM options WHERE pollId = ? ORDER BY position ASC',
    args: [id]
  })
  
  const options = optionsRes.rows.map(row => ({
    id: row.id as string,
    text: row.text as string,
    votes: Number(row.votes)
  }))
  
  return {
    id: pollRow.id as string,
    question: pollRow.question as string,
    totalVotes: Number(pollRow.totalVotes),
    options
  }
}

export async function listPolls(): Promise<Poll[]> {
  const client = await getDb()
  
  const pollsRes = await client.execute('SELECT * FROM polls')
  const polls: Poll[] = []
  
  for (const pollRow of pollsRes.rows) {
    const pollId = pollRow.id as string
    const optionsRes = await client.execute({
      sql: 'SELECT id, text, votes FROM options WHERE pollId = ? ORDER BY position ASC',
      args: [pollId]
    })
    
    const options = optionsRes.rows.map(row => ({
      id: row.id as string,
      text: row.text as string,
      votes: Number(row.votes)
    }))
    
    polls.push({
      id: pollId,
      question: pollRow.question as string,
      totalVotes: Number(pollRow.totalVotes),
      options
    })
  }
  
  return polls
}

export async function castVote(pollId: string, optionId: string, clientId: string): Promise<Poll> {
  const client = await getDb()
  
  const tx = await client.transaction('write')
  try {
    // Check if poll exists
    const pollRes = await tx.execute({
      sql: 'SELECT * FROM polls WHERE id = ?',
      args: [pollId]
    })
    if (pollRes.rows.length === 0) {
      throw new Error('POLL_NOT_FOUND')
    }
    
    // Check if option exists and belongs to poll
    const optionRes = await tx.execute({
      sql: 'SELECT * FROM options WHERE id = ? AND pollId = ?',
      args: [optionId, pollId]
    })
    if (optionRes.rows.length === 0) {
      throw new Error('OPTION_NOT_FOUND')
    }
    
    // Check if client already voted on this poll
    const voteRes = await tx.execute({
      sql: 'SELECT * FROM votes WHERE pollId = ? AND clientId = ?',
      args: [pollId, clientId]
    })
    if (voteRes.rows.length > 0) {
      throw new Error('ALREADY_VOTED')
    }
    
    // Insert vote
    await tx.execute({
      sql: 'INSERT INTO votes (pollId, clientId) VALUES (?, ?)',
      args: [pollId, clientId]
    })
    
    // Increment option votes
    await tx.execute({
      sql: 'UPDATE options SET votes = votes + 1 WHERE id = ?',
      args: [optionId]
    })
    
    // Increment poll total votes
    await tx.execute({
      sql: 'UPDATE polls SET totalVotes = totalVotes + 1 WHERE id = ?',
      args: [pollId]
    })
    
    await tx.commit()
  } catch (err) {
    await tx.rollback()
    throw err
  }
  
  const updatedPoll = await getPoll(pollId)
  if (!updatedPoll) {
    throw new Error('POLL_NOT_FOUND')
  }
  return updatedPoll
}
