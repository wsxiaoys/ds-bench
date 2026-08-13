import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
//#region src/db.server.ts
var dbInstance = null;
function getDb() {
	if (dbInstance) return dbInstance;
	const dbPath = "/home/user/project/data/kanban.sqlite";
	const dbDir = path.dirname(dbPath);
	if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
	const db = new Database(dbPath);
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
		db.transaction(() => {
			insert.run("Write project spec", "todo", 0);
			insert.run("Design database schema", "todo", 1);
			insert.run("Set up CI pipeline", "todo", 2);
			insert.run("Implement board UI", "in-progress", 0);
			insert.run("Wire up server functions", "in-progress", 1);
			insert.run("Kickoff meeting", "done", 0);
		})();
	}
	dbInstance = db;
	return dbInstance;
}
function getBoard() {
	const rows = getDb().prepare("SELECT id, title, column_id as columnId, position FROM cards").all();
	const todoCards = [];
	const inProgressCards = [];
	const doneCards = [];
	for (const row of rows) {
		const card = {
			id: row.id,
			title: row.title,
			position: row.position
		};
		if (row.columnId === "todo") todoCards.push(card);
		else if (row.columnId === "in-progress") inProgressCards.push(card);
		else if (row.columnId === "done") doneCards.push(card);
	}
	todoCards.sort((a, b) => a.position - b.position);
	inProgressCards.sort((a, b) => a.position - b.position);
	doneCards.sort((a, b) => a.position - b.position);
	return { columns: [
		{
			id: "todo",
			title: "Todo",
			cards: todoCards
		},
		{
			id: "in-progress",
			title: "In Progress",
			cards: inProgressCards
		},
		{
			id: "done",
			title: "Done",
			cards: doneCards
		}
	] };
}
function moveCard(cardId, toColumn, toPosition) {
	const db = getDb();
	const allCards = db.prepare("SELECT id, title, column_id as columnId, position FROM cards").all();
	const cardToMove = allCards.find((c) => c.id === cardId);
	if (!cardToMove) throw new Error(`Card with ID ${cardId} not found`);
	const fromColumn = cardToMove.columnId;
	const sourceCards = allCards.filter((c) => c.columnId === fromColumn && c.id !== cardId).sort((a, b) => a.position - b.position);
	const destCards = fromColumn === toColumn ? sourceCards : allCards.filter((c) => c.columnId === toColumn && c.id !== cardId).sort((a, b) => a.position - b.position);
	const targetPos = Math.max(0, Math.min(toPosition, destCards.length));
	const newDestCards = [...destCards];
	newDestCards.splice(targetPos, 0, {
		...cardToMove,
		columnId: toColumn,
		position: targetPos
	});
	newDestCards.forEach((card, i) => {
		card.position = i;
	});
	const newSourceCards = [...sourceCards];
	if (fromColumn !== toColumn) newSourceCards.forEach((card, i) => {
		card.position = i;
	});
	const updateStmt = db.prepare("UPDATE cards SET column_id = ?, position = ? WHERE id = ?");
	db.transaction(() => {
		updateStmt.run(toColumn, targetPos, cardId);
		for (const card of newDestCards) if (card.id !== cardId) updateStmt.run(toColumn, card.position, card.id);
		if (fromColumn !== toColumn) for (const card of newSourceCards) updateStmt.run(fromColumn, card.position, card.id);
	})();
}
//#endregion
export { getBoard, moveCard };
