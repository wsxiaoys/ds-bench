import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "app.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL
  )
`);

function seedIfEmpty() {
  const { c: count } = db.prepare("SELECT COUNT(*) AS c FROM items").get();
  if (count > 0) return;

  const categories = ["Alpha", "Bravo", "Charlie"];
  const insert = db.prepare(
    "INSERT INTO items (id, name, category, status) VALUES (?, ?, ?, ?)",
  );
  const insertAll = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(row.id, row.name, row.category, row.status);
    }
  });

  const rows = [];
  for (let i = 1; i <= 57; i++) {
    rows.push({
      id: i,
      name: `Item ${String(i).padStart(4, "0")}`,
      category: categories[(i - 1) % 3],
      status: "active",
    });
  }
  insertAll(rows);
}

seedIfEmpty();

const app = express();
app.use(express.json());

app.get("/api/items", (req, res) => {
  const status = req.query.status === "archived" ? "archived" : "active";
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.max(1, Math.min(1000, parseInt(req.query.pageSize, 10) || 10));
  const offset = (page - 1) * pageSize;

  const { c: total } = db
    .prepare("SELECT COUNT(*) AS c FROM items WHERE status = ?")
    .get(status);

  const rows = db
    .prepare(
      "SELECT id, name, category, status FROM items WHERE status = ? ORDER BY id ASC LIMIT ? OFFSET ?",
    )
    .all(status, pageSize, offset);

  res.json({ rows, total, page, pageSize });
});

app.post("/api/items/bulk-archive", (req, res) => {
  const body = req.body || {};
  let archived = 0;

  if (body.mode === "all") {
    const status = body.status === "archived" ? "archived" : "active";
    const matching = db
      .prepare("SELECT id FROM items WHERE status = ?")
      .all(status);
    db.prepare("UPDATE items SET status = 'archived' WHERE status = ?").run(
      status,
    );
    archived = matching.length;
  } else if (body.mode === "selected") {
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((n) => Number.isInteger(n))
      : [];
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      db.prepare(
        `UPDATE items SET status = 'archived' WHERE id IN (${placeholders})`,
      ).run(...ids);
      const { c } = db
        .prepare(
          `SELECT COUNT(*) AS c FROM items WHERE status = 'archived' AND id IN (${placeholders})`,
        )
        .get(...ids);
      archived = c;
    }
  } else {
    return res.status(400).json({ error: "invalid request body" });
  }

  res.json({ archived });
});

const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));
app.use((req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 34517;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
