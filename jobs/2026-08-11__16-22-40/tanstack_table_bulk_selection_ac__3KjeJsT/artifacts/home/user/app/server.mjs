import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 34517;
const DB_DIR = '/home/user/app/data';
const DB_PATH = path.join(DB_DIR, 'app.db');

// Ensure DB directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL
  )
`);

// Seed database exactly once with 57 items
const countResult = db.prepare("SELECT COUNT(*) as count FROM items").get();
if (countResult.count === 0) {
  const insert = db.prepare("INSERT INTO items (id, name, category, status) VALUES (?, ?, ?, ?)");
  const insertMany = db.transaction(() => {
    for (let i = 1; i <= 57; i++) {
      const idStr = String(i).padStart(4, '0');
      const name = `Item ${idStr}`;
      const category = ['Alpha', 'Bravo', 'Charlie'][(i - 1) % 3];
      insert.run(i, name, category, 'active');
    }
  });
  insertMany();
}

const app = express();
app.use(express.json());

// JSON API
// GET /api/items?status=<active|archived>&page=<n>&pageSize=<n>
app.get('/api/items', (req, res) => {
  try {
    const status = req.query.status === 'archived' ? 'archived' : 'active';
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    const totalResult = db.prepare("SELECT COUNT(*) as count FROM items WHERE status = ?").get(status);
    const total = totalResult.count;

    const rows = db.prepare("SELECT id, name, category, status FROM items WHERE status = ? LIMIT ? OFFSET ?")
      .all(status, pageSize, offset);

    res.json({
      rows,
      total,
      page,
      pageSize
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/items/bulk-archive
app.post('/api/items/bulk-archive', (req, res) => {
  try {
    const { mode, ids, status } = req.body;
    let archivedCount = 0;

    if (mode === 'selected') {
      if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        // Update to archived
        db.prepare(`UPDATE items SET status = 'archived' WHERE id IN (${placeholders})`).run(...ids);
        // Count how many are now archived in the selected set
        const countRes = db.prepare(`SELECT COUNT(*) as count FROM items WHERE id IN (${placeholders}) AND status = 'archived'`).get(...ids);
        archivedCount = countRes.count;
      }
    } else if (mode === 'all') {
      const targetStatus = status === 'archived' ? 'archived' : 'active';
      // Update all matching items to archived
      const result = db.prepare("UPDATE items SET status = 'archived' WHERE status = ?").run(targetStatus);
      archivedCount = result.changes;
    } else {
      return res.status(400).json({ error: 'Invalid mode' });
    }

    res.json({ archived: archivedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend static assets from dist
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for single page app
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
