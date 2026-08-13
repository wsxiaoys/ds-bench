import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const DB_PATH = '/home/user/project/data/kanban.sqlite'

let dbInstance: Database.Database | null = null

export function getDb() {
  if (dbInstance) {
    return dbInstance
  }

  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  // Create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      column_id TEXT NOT NULL,
      position INTEGER NOT NULL
    );
  `)

  // Check if seed is needed
  const count = db.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number }
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO cards (title, column_id, position) VALUES (?, ?, ?)')
    
    // Seed Todo
    insert.run('Write project spec', 'todo', 0)
    insert.run('Design database schema', 'todo', 1)
    insert.run('Set up CI pipeline', 'todo', 2)
    
    // Seed In Progress
    insert.run('Implement board UI', 'in-progress', 0)
    insert.run('Wire up server functions', 'in-progress', 1)
    
    // Seed Done
    insert.run('Kickoff meeting', 'done', 0)
  }

  dbInstance = db
  return db
}

export function getBoardState() {
  const db = getDb()
  const cards = db.prepare('SELECT id, title, column_id, position FROM cards ORDER BY column_id, position ASC').all() as {
    id: number
    title: string
    column_id: string
    position: number
  }[]

  const columns = [
    { id: 'todo', title: 'Todo', cards: [] as { id: number; title: string; position: number }[] },
    { id: 'in-progress', title: 'In Progress', cards: [] as { id: number; title: string; position: number }[] },
    { id: 'done', title: 'Done', cards: [] as { id: number; title: string; position: number }[] }
  ]

  cards.forEach(card => {
    const col = columns.find(c => c.id === card.column_id)
    if (col) {
      col.cards.push({
        id: card.id,
        title: card.title,
        position: card.position
      })
    }
  })

  // Ensure each column's cards are sorted by position and positions are contiguous starting at 0
  columns.forEach(col => {
    col.cards.sort((a, b) => a.position - b.position)
  })

  return { columns }
}

export function moveCard(cardId: number, targetColumnId: string, targetPosition: number) {
  const db = getDb()

  db.transaction(() => {
    // 1. Get current state of the card
    const card = db.prepare('SELECT column_id, position FROM cards WHERE id = ?').get(cardId) as { column_id: string; position: number } | undefined
    if (!card) {
      throw new Error(`Card with ID ${cardId} not found`)
    }

    const sourceColumnId = card.column_id
    const sourcePosition = card.position

    if (sourceColumnId === targetColumnId) {
      // Case 1: Reordering within the same column
      if (sourcePosition === targetPosition) {
        return // No change
      }

      if (sourcePosition < targetPosition) {
        // Shift cards between sourcePosition + 1 and targetPosition down by 1
        db.prepare(`
          UPDATE cards 
          SET position = position - 1 
          WHERE column_id = ? AND position > ? AND position <= ?
        `).run(sourceColumnId, sourcePosition, targetPosition)
      } else {
        // Shift cards between targetPosition and sourcePosition - 1 up by 1
        db.prepare(`
          UPDATE cards 
          SET position = position + 1 
          WHERE column_id = ? AND position >= ? AND position < ?
        `).run(sourceColumnId, targetPosition, sourcePosition)
      }

      // Update the moved card's position
      db.prepare('UPDATE cards SET position = ? WHERE id = ?').run(targetPosition, cardId)

    } else {
      // Case 2: Moving to a different column
      // 1. Shift cards in source column down (decrement positions after sourcePosition)
      db.prepare(`
        UPDATE cards 
        SET position = position - 1 
        WHERE column_id = ? AND position > ?
      `).run(sourceColumnId, sourcePosition)

      // 2. Shift cards in target column up (increment positions at or after targetPosition)
      db.prepare(`
        UPDATE cards 
        SET position = position + 1 
        WHERE column_id = ? AND position >= ?
      `).run(targetColumnId, targetPosition)

      // 3. Update the moved card's column and position
      db.prepare(`
        UPDATE cards 
        SET column_id = ?, position = ? 
        WHERE id = ?
      `).run(targetColumnId, targetPosition, cardId)
    }

    // Safety measure: Normalize positions in both columns to ensure 0-based, contiguous, no gaps, no duplicates
    const normalize = (colId: string) => {
      const colCards = db.prepare('SELECT id FROM cards WHERE column_id = ? ORDER BY position ASC, id ASC').all(colId) as { id: number }[]
      const updateStmt = db.prepare('UPDATE cards SET position = ? WHERE id = ?')
      colCards.forEach((c, index) => {
        updateStmt.run(index, c.id)
      })
    }

    normalize(sourceColumnId)
    if (sourceColumnId !== targetColumnId) {
      normalize(targetColumnId)
    }
  })()
}
