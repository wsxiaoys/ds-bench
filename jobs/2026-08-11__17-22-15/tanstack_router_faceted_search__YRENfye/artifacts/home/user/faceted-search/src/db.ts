import { DatabaseSync } from 'node:sqlite'
import * as fs from 'node:fs'
import * as path from 'node:path'

const DB_PATH = path.resolve('/home/user/faceted-search/products.db')
const SEED_PATH = path.resolve('/home/user/faceted-search/seed/products.json')

export interface Product {
  id: number
  name: string
  description: string
  category: string
  price: number
  inStock: boolean
  rating: number
  createdAt: string
}

let dbInstance: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance
  }

  dbInstance = new DatabaseSync(DB_PATH)

  // Create products table
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      inStock INTEGER NOT NULL,
      rating REAL NOT NULL,
      createdAt TEXT NOT NULL
    )
  `)

  // Check if table is empty
  const countStmt = dbInstance.prepare('SELECT COUNT(*) as count FROM products')
  const countResult = countStmt.all() as any[]
  const count = countResult[0]?.count || 0

  if (count === 0) {
    console.log('Seeding products database...')
    if (fs.existsSync(SEED_PATH)) {
      try {
        const seedData = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'))
        const insertStmt = dbInstance.prepare(`
          INSERT INTO products (id, name, description, category, price, inStock, rating, createdAt)
          VALUES (:id, :name, :description, :category, :price, :inStock, :rating, :createdAt)
        `)

        for (const item of seedData) {
          insertStmt.run({
            ':id': item.id,
            ':name': item.name,
            ':description': item.description,
            ':category': item.category,
            ':price': item.price,
            ':inStock': item.inStock ? 1 : 0,
            ':rating': item.rating,
            ':createdAt': item.createdAt,
          })
        }
        console.log(`Seeded ${seedData.length} products successfully.`)
      } catch (err) {
        console.error('Error seeding database:', err)
      }
    } else {
      console.warn(`Seed file not found at: ${SEED_PATH}`)
    }
  }

  return dbInstance
}
