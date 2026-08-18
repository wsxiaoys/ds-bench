import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
//#region src/db.ts
var DB_PATH = "/home/user/project/data/kanban.sqlite";
var dbInstance = null;
function getDb() {
	if (dbInstance) return dbInstance;
	const dir = path.dirname(DB_PATH);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
	if (db.prepare("SELECT COUNT(*) as count FROM cards").get().count === 0) {
		const insert = db.prepare("INSERT INTO cards (title, column_id, position) VALUES (?, ?, ?)");
		insert.run("Write project spec", "todo", 0);
		insert.run("Design database schema", "todo", 1);
		insert.run("Set up CI pipeline", "todo", 2);
		insert.run("Implement board UI", "in-progress", 0);
		insert.run("Wire up server functions", "in-progress", 1);
		insert.run("Kickoff meeting", "done", 0);
	}
	dbInstance = db;
	return db;
}
function getBoardState() {
	const cards = getDb().prepare("SELECT id, title, column_id, position FROM cards ORDER BY column_id, position ASC").all();
	const columns = [
		{
			id: "todo",
			title: "Todo",
			cards: []
		},
		{
			id: "in-progress",
			title: "In Progress",
			cards: []
		},
		{
			id: "done",
			title: "Done",
			cards: []
		}
	];
	cards.forEach((card) => {
		const col = columns.find((c) => c.id === card.column_id);
		if (col) col.cards.push({
			id: card.id,
			title: card.title,
			position: card.position
		});
	});
	columns.forEach((col) => {
		col.cards.sort((a, b) => a.position - b.position);
	});
	return { columns };
}
function moveCard(cardId, targetColumnId, targetPosition) {
	const db = getDb();
	db.transaction(() => {
		const card = db.prepare("SELECT column_id, position FROM cards WHERE id = ?").get(cardId);
		if (!card) throw new Error(`Card with ID ${cardId} not found`);
		const sourceColumnId = card.column_id;
		const sourcePosition = card.position;
		if (sourceColumnId === targetColumnId) {
			if (sourcePosition === targetPosition) return;
			if (sourcePosition < targetPosition) db.prepare(`
          UPDATE cards 
          SET position = position - 1 
          WHERE column_id = ? AND position > ? AND position <= ?
        `).run(sourceColumnId, sourcePosition, targetPosition);
			else db.prepare(`
          UPDATE cards 
          SET position = position + 1 
          WHERE column_id = ? AND position >= ? AND position < ?
        `).run(sourceColumnId, targetPosition, sourcePosition);
			db.prepare("UPDATE cards SET position = ? WHERE id = ?").run(targetPosition, cardId);
		} else {
			db.prepare(`
        UPDATE cards 
        SET position = position - 1 
        WHERE column_id = ? AND position > ?
      `).run(sourceColumnId, sourcePosition);
			db.prepare(`
        UPDATE cards 
        SET position = position + 1 
        WHERE column_id = ? AND position >= ?
      `).run(targetColumnId, targetPosition);
			db.prepare(`
        UPDATE cards 
        SET column_id = ?, position = ? 
        WHERE id = ?
      `).run(targetColumnId, targetPosition, cardId);
		}
		const normalize = (colId) => {
			const colCards = db.prepare("SELECT id FROM cards WHERE column_id = ? ORDER BY position ASC, id ASC").all(colId);
			const updateStmt = db.prepare("UPDATE cards SET position = ? WHERE id = ?");
			colCards.forEach((c, index) => {
				updateStmt.run(index, c.id);
			});
		};
		normalize(sourceColumnId);
		if (sourceColumnId !== targetColumnId) normalize(targetColumnId);
	})();
}
//#endregion
export { moveCard as n, getBoardState as t };
