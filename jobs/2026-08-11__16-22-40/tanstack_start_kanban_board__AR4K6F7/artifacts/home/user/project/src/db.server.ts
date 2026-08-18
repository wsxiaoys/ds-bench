import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

let dbInstance: any = null

export function getDb() {
  if (dbInstance) return dbInstance

  const dbPath = '/home/user/project/data/kanban.sqlite'
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // Create table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      column_id TEXT NOT NULL,
      position INTEGER NOT NULL
    );
  `)

  // Check if seeding is needed
  const countRow = db.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number }
  if (countRow.count === 0) {
    const insert = db.prepare('INSERT INTO cards (title, column_id, position) VALUES (?, ?, ?)')
    
    const seedTx = db.transaction(() => {
      // Todo column
      insert.run('Write project spec', 'todo', 0)
      insert.run('Design database schema', 'todo', 1)
      insert.run('Set up CI pipeline', 'todo', 2)

      // In Progress column
      insert.run('Implement board UI', 'in-progress', 0)
      insert.run('Wire up server functions', 'in-progress', 1)

      // Done column
      insert.run('Kickoff meeting', 'done', 0)
    })
    
    seedTx()
  }

  dbInstance = db
  return dbInstance
}

export interface Card {
  id: number
  title: string
  position: number
}

export interface Column {
  id: string
  title: string
  cards: Card[]
}

export interface BoardData {
  columns: Column[]
}

export function getBoard(): BoardData {
  const db = getDb()
  const rows = db.prepare('SELECT id, title, column_id as columnId, position FROM cards').all() as Array<{
    id: number
    title: string
    columnId: string
    position: number
  }>

  const todoCards: Card[] = []
  const inProgressCards: Card[] = []
  const doneCards: Card[] = []

  for (const row of rows) {
    const card: Card = { id: row.id, title: row.title, position: row.position }
    if (row.columnId === 'todo') {
      todoCards.push(card)
    } else if (row.columnId === 'in-progress') {
      inProgressCards.push(card)
    } else if (row.columnId === 'done') {
      doneCards.push(card)
    }
  }

  todoCards.sort((a, b) => a.position - b.position)
  inProgressCards.sort((a, b) => a.position - b.position)
  doneCards.sort((a, b) => a.position - b.position)

  return {
    columns: [
      { id: 'todo', title: 'Todo', cards: todoCards },
      { id: 'in-progress', title: 'In Progress', cards: inProgressCards },
      { id: 'done', title: 'Done', cards: doneCards },
    ]
  }
}

export function moveCard(cardId: number, toColumn: string, toPosition: number): void {
  const db = getDb()
  
  // Fetch all cards
  const allCards = db.prepare('SELECT id, title, column_id as columnId, position FROM cards').all() as Array<{
    id: number
    title: string
    columnId: string
    position: number
  }>

  const cardToMove = allCards.find(c => c.id === cardId)
  if (!cardToMove) {
    throw new Error(`Card with ID ${cardId} not found`)
  }

  const fromColumn = cardToMove.columnId

  // Get source column cards (excluding moved card) sorted by position
  const sourceCards = allCards
    .filter(c => c.columnId === fromColumn && c.id !== cardId)
    .sort((a, b) => a.position - b.position)

  // Get destination column cards sorted by position
  const destCards = fromColumn === toColumn
    ? sourceCards
    : allCards
        .filter(c => c.columnId === toColumn && c.id !== cardId)
        .sort((a, b) => a.position - b.position)

  // Insert the moved card into destination column
  const targetPos = Math.max(0, Math.min(toPosition, destCards.length))
  const newDestCards = [...destCards]
  newDestCards.splice(targetPos, 0, { ...cardToMove, columnId: toColumn, position: targetPos })

  // Re-assign contiguous zero-based positions to destination cards
  newDestCards.forEach((card, i) => {
    card.position = i
  })

  // Re-assign contiguous zero-based positions to source cards (if different column)
  const newSourceCards = [...sourceCards]
  if (fromColumn !== toColumn) {
    newSourceCards.forEach((card, i) => {
      card.position = i
    })
  }

  // Write changes atomically
  const updateStmt = db.prepare('UPDATE cards SET column_id = ?, position = ? WHERE id = ?')
  
  const writeTx = db.transaction(() => {
    // Update the card being moved first
    updateStmt.run(toColumn, targetPos, cardId)
    
    // Update other cards in destination column
    for (const card of newDestCards) {
      if (card.id !== cardId) {
        updateStmt.run(toColumn, card.position, card.id)
      }
    }
    
    // If moved to a different column, update other cards in source column
    if (fromColumn !== toColumn) {
      for (const card of newSourceCards) {
        updateStmt.run(fromColumn, card.position, card.id)
      }
    }
  })

  writeTx()
}
