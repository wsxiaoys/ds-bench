import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "../server.js";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
//#region node_modules/@tanstack/start-server-core/dist/esm/createServerRpc.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
//#endregion
//#region src/db.ts
var DB_DIR = "/home/user/project/data";
var DB_PATH = path.join(DB_DIR, "kanban.sqlite");
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
var db = new Database(DB_PATH);
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
function getBoard() {
	const cards = db.prepare("SELECT id, title, column_id, position FROM cards ORDER BY column_id, position ASC").all();
	const todoCards = cards.filter((c) => c.column_id === "todo").map((c) => ({
		id: c.id,
		title: c.title,
		position: c.position
	}));
	const inProgressCards = cards.filter((c) => c.column_id === "in-progress").map((c) => ({
		id: c.id,
		title: c.title,
		position: c.position
	}));
	const doneCards = cards.filter((c) => c.column_id === "done").map((c) => ({
		id: c.id,
		title: c.title,
		position: c.position
	}));
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
var moveCardTransaction = db.transaction((cardId, targetCol, targetPos) => {
	const card = db.prepare("SELECT id, column_id, position FROM cards WHERE id = ?").get(cardId);
	if (!card) throw new Error(`Card with ID ${cardId} not found`);
	const sourceCol = card.column_id;
	const sourcePos = card.position;
	const countResult = db.prepare("SELECT COUNT(*) as count FROM cards WHERE column_id = ?").get(targetCol);
	const maxPos = sourceCol === targetCol ? countResult.count - 1 : countResult.count;
	const clampedTargetPos = Math.max(0, Math.min(targetPos, maxPos));
	if (sourceCol === targetCol) {
		if (sourcePos === clampedTargetPos) return;
		if (sourcePos < clampedTargetPos) db.prepare(`
        UPDATE cards 
        SET position = position - 1 
        WHERE column_id = ? AND position > ? AND position <= ?
      `).run(sourceCol, sourcePos, clampedTargetPos);
		else db.prepare(`
        UPDATE cards 
        SET position = position + 1 
        WHERE column_id = ? AND position >= ? AND position < ?
      `).run(sourceCol, clampedTargetPos, sourcePos);
		db.prepare("UPDATE cards SET position = ? WHERE id = ?").run(clampedTargetPos, cardId);
	} else {
		db.prepare(`
      UPDATE cards 
      SET position = position - 1 
      WHERE column_id = ? AND position > ?
    `).run(sourceCol, sourcePos);
		db.prepare(`
      UPDATE cards 
      SET position = position + 1 
      WHERE column_id = ? AND position >= ?
    `).run(targetCol, clampedTargetPos);
		db.prepare("UPDATE cards SET column_id = ?, position = ? WHERE id = ?").run(targetCol, clampedTargetPos, cardId);
	}
});
//#endregion
//#region src/routes/index.tsx?tss-serverfn-split
var getBoardFn_createServerFn_handler = createServerRpc({
	id: "6c6115329bf8496a120e22b18a35fe363fa042e86294917e292041fcb41640fa",
	name: "getBoardFn",
	filename: "src/routes/index.tsx"
}, (opts) => getBoardFn.__executeServer(opts));
var getBoardFn = createServerFn({ method: "GET" }).handler(getBoardFn_createServerFn_handler, async () => {
	return getBoard();
});
var moveCardFn_createServerFn_handler = createServerRpc({
	id: "c99c569e04604dc8b039f379f504a828c070a41ce72eda399bf7d18b02317ec6",
	name: "moveCardFn",
	filename: "src/routes/index.tsx"
}, (opts) => moveCardFn.__executeServer(opts));
var moveCardFn = createServerFn({ method: "POST" }).validator((data) => data).handler(moveCardFn_createServerFn_handler, async ({ data }) => {
	moveCardTransaction(data.cardId, data.targetCol, data.targetPos);
	return { success: true };
});
//#endregion
export { getBoardFn_createServerFn_handler, moveCardFn_createServerFn_handler };
