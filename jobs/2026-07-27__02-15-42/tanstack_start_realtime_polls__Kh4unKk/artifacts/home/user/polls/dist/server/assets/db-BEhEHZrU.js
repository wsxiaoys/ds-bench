import { createClient } from "@libsql/client";
import { v4 } from "uuid";
//#region src/db.ts
var db = createClient({ url: "file:local.db" });
var initPromise = (async () => {
	await db.execute(`
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      totalVotes INTEGER DEFAULT 0
    )
  `);
	await db.execute(`
    CREATE TABLE IF NOT EXISTS options (
      id TEXT PRIMARY KEY,
      pollId TEXT NOT NULL,
      text TEXT NOT NULL,
      votes INTEGER DEFAULT 0,
      position INTEGER NOT NULL,
      FOREIGN KEY (pollId) REFERENCES polls(id) ON DELETE CASCADE
    )
  `);
	await db.execute(`
    CREATE TABLE IF NOT EXISTS votes (
      pollId TEXT NOT NULL,
      clientId TEXT NOT NULL,
      PRIMARY KEY (pollId, clientId)
    )
  `);
})();
async function getDb() {
	await initPromise;
	return db;
}
async function createPoll(question, optionTexts) {
	const client = await getDb();
	const pollId = v4();
	const tx = await client.transaction("write");
	try {
		await tx.execute({
			sql: "INSERT INTO polls (id, question, totalVotes) VALUES (?, ?, 0)",
			args: [pollId, question]
		});
		const options = [];
		for (let i = 0; i < optionTexts.length; i++) {
			const optionId = v4();
			const text = optionTexts[i];
			await tx.execute({
				sql: "INSERT INTO options (id, pollId, text, votes, position) VALUES (?, ?, ?, 0, ?)",
				args: [
					optionId,
					pollId,
					text,
					i
				]
			});
			options.push({
				id: optionId,
				text,
				votes: 0
			});
		}
		await tx.commit();
		return {
			id: pollId,
			question,
			totalVotes: 0,
			options
		};
	} catch (err) {
		await tx.rollback();
		throw err;
	}
}
async function getPoll(id) {
	const client = await getDb();
	const pollRes = await client.execute({
		sql: "SELECT * FROM polls WHERE id = ?",
		args: [id]
	});
	if (pollRes.rows.length === 0) return null;
	const pollRow = pollRes.rows[0];
	const options = (await client.execute({
		sql: "SELECT id, text, votes FROM options WHERE pollId = ? ORDER BY position ASC",
		args: [id]
	})).rows.map((row) => ({
		id: row.id,
		text: row.text,
		votes: Number(row.votes)
	}));
	return {
		id: pollRow.id,
		question: pollRow.question,
		totalVotes: Number(pollRow.totalVotes),
		options
	};
}
async function listPolls() {
	const client = await getDb();
	const pollsRes = await client.execute("SELECT * FROM polls");
	const polls = [];
	for (const pollRow of pollsRes.rows) {
		const pollId = pollRow.id;
		const options = (await client.execute({
			sql: "SELECT id, text, votes FROM options WHERE pollId = ? ORDER BY position ASC",
			args: [pollId]
		})).rows.map((row) => ({
			id: row.id,
			text: row.text,
			votes: Number(row.votes)
		}));
		polls.push({
			id: pollId,
			question: pollRow.question,
			totalVotes: Number(pollRow.totalVotes),
			options
		});
	}
	return polls;
}
async function castVote(pollId, optionId, clientId) {
	const tx = await (await getDb()).transaction("write");
	try {
		if ((await tx.execute({
			sql: "SELECT * FROM polls WHERE id = ?",
			args: [pollId]
		})).rows.length === 0) throw new Error("POLL_NOT_FOUND");
		if ((await tx.execute({
			sql: "SELECT * FROM options WHERE id = ? AND pollId = ?",
			args: [optionId, pollId]
		})).rows.length === 0) throw new Error("OPTION_NOT_FOUND");
		if ((await tx.execute({
			sql: "SELECT * FROM votes WHERE pollId = ? AND clientId = ?",
			args: [pollId, clientId]
		})).rows.length > 0) throw new Error("ALREADY_VOTED");
		await tx.execute({
			sql: "INSERT INTO votes (pollId, clientId) VALUES (?, ?)",
			args: [pollId, clientId]
		});
		await tx.execute({
			sql: "UPDATE options SET votes = votes + 1 WHERE id = ?",
			args: [optionId]
		});
		await tx.execute({
			sql: "UPDATE polls SET totalVotes = totalVotes + 1 WHERE id = ?",
			args: [pollId]
		});
		await tx.commit();
	} catch (err) {
		await tx.rollback();
		throw err;
	}
	const updatedPoll = await getPoll(pollId);
	if (!updatedPoll) throw new Error("POLL_NOT_FOUND");
	return updatedPoll;
}
//#endregion
export { listPolls as i, createPoll as n, getPoll as r, castVote as t };
