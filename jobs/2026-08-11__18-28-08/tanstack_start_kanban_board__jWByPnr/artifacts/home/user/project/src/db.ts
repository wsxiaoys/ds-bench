import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_DIR = '/home/user/project/data'
const DB_PATH = path.join(DB_DIR, 'kanban.sqlite')

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

const db = new Database(DB_PATH)

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    column_id TEXT NOT NULL,
    position INTEGER NOT NULL
  );
`)

// Seed if empty
const countResult = db.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number }
if (countResult.count === 0) {
  const insert = db.prepare('INSERT INTO cards (title, column_id, position) VALUES (?, ?, ?)')
  // Todo
  insert.run('Write project spec', 'todo', 0)
  insert.run('Design database schema', 'todo', 1)
  insert.run('Set up CI pipeline', 'todo', 2)
  // In Progress
  insert.run('Implement board UI', 'in-progress', 0)
  insert.run('Wire up server functions', 'in-progress', 1)
  // Done
  insert.run('Kickoff meeting', 'done', 0)
}

export interface Card {
  id: number
  title: string
  column_id: string
  position: number
}

export function getBoard() {
  const cards = db.prepare('SELECT id, title, column_id, position FROM cards ORDER BY column_id, position ASC').all() as Card[]
  
  const todoCards = cards.filter(c => c.column_id === 'todo').map(c => ({ id: c.id, title: c.title, position: c.position }))
  const inProgressCards = cards.filter(c => c.column_id === 'in-progress').map(c => ({ id: c.id, title: c.title, position: c.position }))
  const doneCards = cards.filter(c => c.column_id === 'done').map(c => ({ id: c.id, title: c.title, position: c.position }))

  return {
    columns: [
      { id: 'todo', title: 'Todo', cards: todoCards },
      { id: 'in-progress', title: 'In Progress', cards: inProgressCards },
      { id: 'done', title: 'Done', cards: doneCards }
    ]
  }
}

export const moveCardTransaction = db.transaction((cardId: number, targetCol: string, targetPos: number) => {
  // Get the card to move
  const card = db.prepare('SELECT id, column_id, position FROM cards WHERE id = ?').get(cardId) as Card | undefined
  if (!card) {
    throw new Error(`Card with ID ${cardId} not found`)
  }

  const sourceCol = card.column_id
  const sourcePos = card.position

  // Get total count in target column to clamp targetPos safely
  const countResult = db.prepare('SELECT COUNT(*) as count FROM cards WHERE column_id = ?').get(targetCol) as { count: number }
  const maxPos = sourceCol === targetCol ? countResult.count - 1 : countResult.count
  const clampedTargetPos = Math.max(0, Math.min(targetPos, maxPos))

  if (sourceCol === targetCol) {
    // Reordering within the same column
    if (sourcePos === clampedTargetPos) return

    if (sourcePos < clampedTargetPos) {
      // Moving down
      // Decrement positions of cards in (sourcePos, clampedTargetPos]
      db.prepare(`
        UPDATE cards 
        SET position = position - 1 
        WHERE column_id = ? AND position > ? AND position <= ?
      `).run(sourceCol, sourcePos, clampedTargetPos)
    } else {
      // Moving up
      // Increment positions of cards in [clampedTargetPos, sourcePos)
      db.prepare(`
        UPDATE cards 
        SET position = position + 1 
        WHERE column_id = ? AND position >= ? AND position < ?
      `).run(sourceCol, clampedTargetPos, sourcePos)
    }
    // Update the card being moved
    db.prepare('UPDATE cards SET position = ? WHERE id = ?').run(clampedTargetPos, cardId)
  } else {
    // Moving between different columns
    // 1. Decrement positions of cards in source column that were after the moved card
    db.prepare(`
      UPDATE cards 
      SET position = position - 1 
      WHERE column_id = ? AND position > ?
    `).run(sourceCol, sourcePos)

    // 2. Increment positions of cards in target column that are at or after the target position
    db.prepare(`
      UPDATE cards 
      SET position = position + 1 
      WHERE column_id = ? AND position >= ?
    `).run(targetCol, clampedTargetPos)

    // 3. Update the moved card's column and position
    db.prepare('UPDATE cards SET column_id = ?, position = ? WHERE id = ?').run(targetCol, clampedTargetPos, cardId)
  }
})
