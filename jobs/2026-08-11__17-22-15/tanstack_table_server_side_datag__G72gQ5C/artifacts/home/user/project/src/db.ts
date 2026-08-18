import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

const dbPath = path.resolve(process.cwd(), 'employees.db')
export const db = new DatabaseSync(dbPath)

// Initialize DB and Seed Data if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    department TEXT NOT NULL,
    salary INTEGER NOT NULL
  )
`)

// Check if seeded
const countQuery = db.prepare('SELECT COUNT(*) as count FROM employees')
const result = countQuery.get() as { count: number }

if (result.count === 0) {
  const insert = db.prepare(`
    INSERT INTO employees (id, name, email, department, salary)
    VALUES (?, ?, ?, ?, ?)
  `)
  
  const seedData = [
    [1, "Alice Johnson", "mailto:alice.johnson@corp.test", "Engineering", 95000],
    [2, "Bob Smith", "mailto:bob.smith@corp.test", "Sales", 62000],
    [3, "Carol Nguyen", "mailto:carol.nguyen@corp.test", "Engineering", 88000],
    [4, "David Lee", "mailto:david.lee@corp.test", "Support", 54000],
    [5, "Emma Brown", "mailto:emma.brown@corp.test", "Design", 71000],
    [6, "Frank Wilson", "mailto:frank.wilson@corp.test", "Sales", 67000],
    [7, "Grace Kim", "mailto:grace.kim@corp.test", "Engineering", 102000],
    [8, "Henry Davis", "mailto:henry.davis@corp.test", "Support", 58000],
    [9, "Ivy Martinez", "mailto:ivy.martinez@corp.test", "Design", 76000],
    [10, "Jack Nguyen", "mailto:jack.nguyen@corp.test", "Sales", 69000],
    [11, "Karen Miller", "mailto:karen.miller@corp.test", "Support", 60000],
    [12, "Leo Garcia", "mailto:leo.garcia@corp.test", "Engineering", 91000],
    [13, "Mia Rodriguez", "mailto:mia.rodriguez@corp.test", "Design", 73000],
    [14, "Noah Anderson", "mailto:noah.anderson@corp.test", "Sales", 64000],
    [15, "Olivia Thomas", "mailto:olivia.thomas@corp.test", "Engineering", 99000],
    [16, "Paul Nguyen", "mailto:paul.nguyen@corp.test", "Support", 57000],
    [17, "Quinn Taylor", "mailto:quinn.taylor@corp.test", "Design", 78000],
    [18, "Ruby Moore", "mailto:ruby.moore@corp.test", "Sales", 66000],
    [19, "Sam Jackson", "mailto:sam.jackson@corp.test", "Engineering", 105000],
    [20, "Tina White", "mailto:tina.white@corp.test", "Support", 59000],
    [21, "Uma Harris", "mailto:uma.harris@corp.test", "Design", 74000],
    [22, "Victor Clark", "mailto:victor.clark@corp.test", "Sales", 63000],
    [23, "Wendy Lewis", "mailto:wendy.lewis@corp.test", "Engineering", 97000],
    [24, "Xander Walker", "mailto:xander.walker@corp.test", "Support", 56000]
  ]

  for (const row of seedData) {
    insert.run(row[0], row[1], row[2], row[3], row[4])
  }
}
