import express from 'express';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 34517;
const app = express();

app.use(express.json());

// Initialize SQLite database
const dbDir = '/home/user/app/data';
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'app.db');
const db = new Database(dbPath);

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL
  )
`);

// Idempotent seeding
const countRow = db.prepare('SELECT COUNT(*) as count FROM items').get();
if (countRow.count === 0) {
  const insert = db.prepare('INSERT INTO items (id, name, category, status) VALUES (?, ?, ?, ?)');
  const insertMany = db.transaction(() => {
    for (let i = 1; i <= 57; i++) {
      const idStr = String(i).padStart(4, '0');
      const name = `Item ${idStr}`;
      const category = ['Alpha', 'Bravo', 'Charlie'][(i - 1) % 3];
      const status = 'active';
      insert.run(i, name, category, status);
    }
  });
  insertMany();
  console.log('Database successfully seeded with 57 items.');
} else {
  console.log(`Database already contains ${countRow.count} items.`);
}

// API: GET /api/items
app.get('/api/items', (req, res) => {
  try {
    const status = req.query.status || 'active';
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 10;
    
    const offset = (page - 1) * pageSize;
    
    const totalRow = db.prepare('SELECT COUNT(*) as count FROM items WHERE status = ?').get(status);
    const total = totalRow ? totalRow.count : 0;
    
    const rows = db.prepare('SELECT id, name, category, status FROM items WHERE status = ? LIMIT ? OFFSET ?').all(status, pageSize, offset);
    
    res.json({
      rows,
      total,
      page,
      pageSize
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: POST /api/items/bulk-archive
app.post('/api/items/bulk-archive', (req, res) => {
  try {
    const { mode, ids, status } = req.body;
    
    if (mode === 'selected') {
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.json({ archived: 0 });
      }
      
      const updateStmt = db.prepare("UPDATE items SET status = 'archived' WHERE id = ?");
      const checkStmt = db.prepare("SELECT status FROM items WHERE id = ?");
      
      const runBulkSelected = db.transaction((targetIds) => {
        let archivedCount = 0;
        for (const id of targetIds) {
          const row = checkStmt.get(id);
          if (row) {
            if (row.status !== 'archived') {
              updateStmt.run(id);
            }
            archivedCount++;
          }
        }
        return archivedCount;
      });
      
      const archived = runBulkSelected(ids);
      return res.json({ archived });
    } else if (mode === 'all') {
      if (!status) {
        return res.status(400).json({ error: 'Status is required for mode "all"' });
      }
      
      const selectStmt = db.prepare("SELECT id FROM items WHERE status = ?");
      const updateStmt = db.prepare("UPDATE items SET status = 'archived' WHERE status = ?");
      
      const runBulkAll = db.transaction((targetStatus) => {
        const rows = selectStmt.all(targetStatus);
        updateStmt.run(targetStatus);
        return rows.length;
      });
      
      const archived = runBulkAll(status);
      return res.json({ archived });
    } else {
      return res.status(400).json({ error: 'Invalid mode' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static built files from dist/
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback for single-page app routing (serve index.html for any non-API route)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
