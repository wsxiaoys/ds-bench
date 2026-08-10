import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// This module is server-only. It must never be imported from client code.
// (It is only ever referenced from `src/utils/products.server.ts`, which is
// exclusively consumed by `createServerFn` handlers.)

type SeedProduct = {
  id: number
  name: string
  description: string
  category: string
  price: number
  inStock: boolean
  rating: number
  createdAt: string
}

const projectRoot = (() => {
  // src/utils -> src -> project root
  const here = dirname(fileURLToPath(import.meta.url))
  return join(here, '..', '..')
})()

const dataDir = join(projectRoot, '.data')
const dbPath = join(dataDir, 'app.db')
const seedPath = join(projectRoot, 'seed', 'products.json')

let db: DatabaseSync | undefined

function createSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      inStock INTEGER NOT NULL,
      rating REAL NOT NULL,
      createdAt TEXT NOT NULL
    );
  `)
}

function seedIfEmpty(database: DatabaseSync) {
  const row = database.prepare('SELECT COUNT(*) as count FROM products').get() as
    | { count: number }
    | undefined

  if (row && row.count > 0) {
    return
  }

  const raw = readFileSync(seedPath, 'utf-8')
  const products = JSON.parse(raw) as Array<SeedProduct>

  const insert = database.prepare(
    `INSERT INTO products (id, name, description, category, price, inStock, rating, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  database.exec('BEGIN')
  try {
    for (const p of products) {
      insert.run(
        p.id,
        p.name,
        p.description,
        p.category,
        p.price,
        p.inStock ? 1 : 0,
        p.rating,
        p.createdAt,
      )
    }
    database.exec('COMMIT')
  } catch (err) {
    database.exec('ROLLBACK')
    throw err
  }
}

export function getDb(): DatabaseSync {
  if (db) return db

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  db = new DatabaseSync(dbPath)
  createSchema(db)
  seedIfEmpty(db)

  return db
}
