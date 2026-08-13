import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Database setup
const dbPath = '/home/user/app/data/app.db';
const db = new Database(dbPath);

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL
  )
`);

// Idempotent seeding
const countResult = db.prepare('SELECT COUNT(*) as count FROM items').get();
if (countResult.count === 0) {
  const insertStmt = db.prepare('INSERT INTO items (id, name, category, status) VALUES (?, ?, ?, ?)');
  const insertMany = db.transaction(() => {
    for (let i = 1; i <= 57; i++) {
      const id = i;
      const name = `Item ${String(i).padStart(4, '0')}`;
      const category = ['Alpha', 'Bravo', 'Charlie'][(i - 1) % 3];
      const status = 'active';
      insertStmt.run(id, name, category, status);
    }
  });
  insertMany();
  console.log('Database seeded with 57 items.');
} else {
  console.log('Database already has items. Skipping seeding.');
}

// API Endpoints
// GET /api/items?status=<active|archived>&page=<n>&pageSize=<n>
app.get('/api/items', (req, res) => {
  try {
    const status = req.query.status || 'active';
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 10;

    if (status !== 'active' && status !== 'archived') {
      return res.status(400).json({ error: 'Invalid status filter' });
    }

    const offset = (page - 1) * pageSize;

    // Get total matching
    const totalResult = db.prepare('SELECT COUNT(*) as count FROM items WHERE status = ?').get(status);
    const total = totalResult.count;

    // Get items for current page
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

// POST /api/items/bulk-archive
app.post('/api/items/bulk-archive', (req, res) => {
  try {
    const { mode } = req.body;

    if (mode === 'selected') {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: 'Invalid ids array' });
      }
      if (ids.length === 0) {
        return res.json({ archived: 0 });
      }

      // Update their status to 'archived'
      const placeholders = ids.map(() => '?').join(',');
      const updateStmt = db.prepare(`UPDATE items SET status = 'archived' WHERE id IN (${placeholders})`);
      updateStmt.run(...ids);

      // Count how many of these IDs are now archived
      const countStmt = db.prepare(`SELECT COUNT(*) as count FROM items WHERE id IN (${placeholders}) AND status = 'archived'`);
      const countResult = countStmt.get(...ids);

      res.json({ archived: countResult.count });
    } else if (mode === 'all') {
      const { status } = req.body;
      if (status !== 'active' && status !== 'archived') {
        return res.status(400).json({ error: 'Invalid status' });
      }

      if (status === 'active') {
        // Find how many are active before archiving
        const beforeResult = db.prepare("SELECT COUNT(*) as count FROM items WHERE status = 'active'").get();
        const activeCount = beforeResult.count;

        // Archive them
        db.prepare("UPDATE items SET status = 'archived' WHERE status = 'active'").run();

        res.json({ archived: activeCount });
      } else {
        // Already archived
        const archivedResult = db.prepare("SELECT COUNT(*) as count FROM items WHERE status = 'archived'").get();
        res.json({ archived: archivedResult.count });
      }
    } else {
      res.status(400).json({ error: 'Invalid mode' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve built frontend files
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for single-page app routing
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 34517;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
