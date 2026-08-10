import "@tanstack/react-start/server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const COLUMNS = [
  { id: "todo", title: "Todo" },
  { id: "in-progress", title: "In Progress" },
  { id: "done", title: "Done" },
] as const;

export type ColumnId = (typeof COLUMNS)[number]["id"];

const COLUMN_IDS: readonly string[] = COLUMNS.map((c) => c.id);

const SEED_CARDS: Record<ColumnId, string[]> = {
  todo: ["Write project spec", "Design database schema", "Set up CI pipeline"],
  "in-progress": ["Implement board UI", "Wire up server functions"],
  done: ["Kickoff meeting"],
};

const DB_PATH = path.resolve(process.cwd(), "data/kanban.sqlite");

let dbInstance: Database.Database | null = null;

function seedIfEmpty(db: Database.Database) {
  const row = db.prepare("SELECT COUNT(*) as count FROM cards").get() as {
    count: number;
  };
  if (row.count > 0) return;

  const insert = db.prepare(
    "INSERT INTO cards (title, column_id, position) VALUES (?, ?, ?)",
  );
  const seedAll = db.transaction(() => {
    for (const col of COLUMNS) {
      SEED_CARDS[col.id].forEach((title, index) => {
        insert.run(title, col.id, index);
      });
    }
  });
  seedAll();
}

function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      column_id TEXT NOT NULL,
      position INTEGER NOT NULL
    );
  `);
  seedIfEmpty(db);

  dbInstance = db;
  return db;
}

export type BoardCard = { id: number; title: string; position: number };
export type BoardColumn = { id: string; title: string; cards: BoardCard[] };
export type BoardData = { columns: BoardColumn[] };

export function getBoard(): BoardData {
  const db = getDb();
  const columns = COLUMNS.map((col) => {
    const cards = db
      .prepare(
        "SELECT id, title, position FROM cards WHERE column_id = ? ORDER BY position ASC",
      )
      .all(col.id) as BoardCard[];
    return { id: col.id, title: col.title, cards };
  });
  return { columns };
}

/**
 * Moves a card to a (possibly different) column at the given zero-based
 * index, re-numbering positions of every affected column so that they
 * remain a contiguous, zero-based sequence. Runs inside a single SQLite
 * transaction so the invariant always holds even if something fails
 * partway through.
 */
export function moveCard(
  cardId: number,
  toColumnId: string,
  toIndex: number,
): BoardData {
  if (!COLUMN_IDS.includes(toColumnId)) {
    throw new Error(`Invalid column id: ${toColumnId}`);
  }

  const db = getDb();

  const run = db.transaction(() => {
    const cardRow = db
      .prepare("SELECT id, column_id FROM cards WHERE id = ?")
      .get(cardId) as { id: number; column_id: string } | undefined;

    if (!cardRow) {
      throw new Error(`Card not found: ${cardId}`);
    }

    const fromColumnId = cardRow.column_id;

    const fromIds = (
      db
        .prepare(
          "SELECT id FROM cards WHERE column_id = ? ORDER BY position ASC",
        )
        .all(fromColumnId) as { id: number }[]
    ).map((r) => r.id);

    const existingIndex = fromIds.indexOf(cardId);
    if (existingIndex !== -1) fromIds.splice(existingIndex, 1);

    const toIds =
      fromColumnId === toColumnId
        ? fromIds
        : (
            db
              .prepare(
                "SELECT id FROM cards WHERE column_id = ? ORDER BY position ASC",
              )
              .all(toColumnId) as { id: number }[]
          ).map((r) => r.id);

    const clampedIndex = Math.max(0, Math.min(toIndex, toIds.length));
    toIds.splice(clampedIndex, 0, cardId);

    const updatePosition = db.prepare(
      "UPDATE cards SET column_id = ?, position = ? WHERE id = ?",
    );

    if (fromColumnId !== toColumnId) {
      fromIds.forEach((id, index) => {
        updatePosition.run(fromColumnId, index, id);
      });
    }
    toIds.forEach((id, index) => {
      updatePosition.run(toColumnId, index, id);
    });
  });

  run();

  return getBoard();
}
