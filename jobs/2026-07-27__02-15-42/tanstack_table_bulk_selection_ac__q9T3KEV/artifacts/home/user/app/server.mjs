import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = '/home/user/app/data';
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'app.db');
const db = new Database(dbPath);

// Create table and seed database idempotently
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL
  )
`);

const countResult = db.prepare('SELECT COUNT(*) as count FROM items').get();
if (countResult.count === 0) {
  const insertStmt = db.prepare('INSERT INTO items (id, name, category, status) VALUES (?, ?, ?, ?)');
  const categories = ['Alpha', 'Bravo', 'Charlie'];
  
  db.transaction(() => {
    for (let i = 1; i <= 57; i++) {
      const name = `Item ${String(i).padStart(4, '0')}`;
      const category = categories[(i - 1) % 3];
      const status = 'active';
      insertStmt.run(i, name, category, status);
    }
  })();
  console.log('Database successfully seeded with 57 items.');
} else {
  console.log(`Database already contains ${countResult.count} items. Skipping seeding.`);
}

const app = express();
app.use(express.json());

// JSON API
app.get('/api/items', (req, res) => {
  try {
    const status = req.query.status === 'archived' ? 'archived' : 'active';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.max(1, parseInt(req.query.pageSize) || 10);
    
    const totalResult = db.prepare('SELECT COUNT(*) as count FROM items WHERE status = ?').get(status);
    const total = totalResult.count;
    
    const offset = (page - 1) * pageSize;
    const rows = db.prepare('SELECT id, name, category, status FROM items WHERE status = ? LIMIT ? OFFSET ?')
      .all(status, pageSize, offset);
      
    res.json({
      rows,
      total,
      page,
      pageSize
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/items/bulk-archive', (req, res) => {
  try {
    const { mode, ids, status } = req.body;
    let archivedCount = 0;
    
    if (mode === 'selected') {
      if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const stmt = db.prepare(`UPDATE items SET status = 'archived' WHERE id IN (${placeholders}) AND status = 'active'`);
        const info = stmt.run(...ids);
        archivedCount = info.changes;
      }
    } else if (mode === 'all') {
      const targetStatus = status === 'archived' ? 'archived' : 'active';
      const stmt = db.prepare(`UPDATE items SET status = 'archived' WHERE status = ?`);
      const info = stmt.run(targetStatus);
      archivedCount = info.changes;
    } else {
      return res.status(400).json({ error: 'Invalid mode' });
    }
    
    res.json({ archived: archivedCount });
  } catch (error) {
    console.error('Error bulk archiving items:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Serve built single-page app
const distDir = '/home/user/app/dist';
app.use(express.static(distDir));

app.get('*all', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend build not found. Please build the app first.');
  }
});

const PORT = process.env.PORT || 34517;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
