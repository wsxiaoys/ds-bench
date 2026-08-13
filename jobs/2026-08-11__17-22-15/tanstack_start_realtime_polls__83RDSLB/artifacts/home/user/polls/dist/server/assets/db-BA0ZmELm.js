import sqlite3 from "sqlite3";
import { open } from "sqlite";
import crypto from "crypto";
let db = null;
async function getDb() {
  if (db) return db;
  db = await open({
    filename: "./polls.db",
    driver: sqlite3.Database
  });
  await db.run("PRAGMA foreign_keys = ON");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS options (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL,
      text TEXT NOT NULL,
      votes INTEGER DEFAULT 0,
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS votes (
      poll_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      option_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (poll_id, client_id)
    );
  `);
  return db;
}
async function createPoll(question, optionTexts) {
  const database = await getDb();
  const pollId = crypto.randomUUID();
  await database.run("INSERT INTO polls (id, question) VALUES (?, ?)", pollId, question);
  const options = [];
  for (const text of optionTexts) {
    const optionId = crypto.randomUUID();
    await database.run(
      "INSERT INTO options (id, poll_id, text, votes) VALUES (?, ?, ?, 0)",
      optionId,
      pollId,
      text
    );
    options.push({ id: optionId, text, votes: 0 });
  }
  return {
    id: pollId,
    question,
    totalVotes: 0,
    options
  };
}
async function getPoll(id) {
  const database = await getDb();
  const pollRow = await database.get("SELECT * FROM polls WHERE id = ?", id);
  if (!pollRow) return null;
  const optionRows = await database.all("SELECT * FROM options WHERE poll_id = ?", id);
  let totalVotes = 0;
  const options = optionRows.map((row) => {
    totalVotes += row.votes;
    return {
      id: row.id,
      text: row.text,
      votes: row.votes
    };
  });
  return {
    id: pollRow.id,
    question: pollRow.question,
    totalVotes,
    options
  };
}
async function listAllPolls() {
  const database = await getDb();
  const pollRows = await database.all("SELECT * FROM polls ORDER BY created_at DESC");
  const polls = [];
  for (const p of pollRows) {
    const optionRows = await database.all("SELECT * FROM options WHERE poll_id = ?", p.id);
    let totalVotes = 0;
    const options = optionRows.map((row) => {
      totalVotes += row.votes;
      return {
        id: row.id,
        text: row.text,
        votes: row.votes
      };
    });
    polls.push({
      id: p.id,
      question: p.question,
      totalVotes,
      options
    });
  }
  return polls;
}
async function castVote(pollId, optionId, clientId) {
  const database = await getDb();
  const poll = await getPoll(pollId);
  if (!poll) {
    throw new Error("POLL_NOT_FOUND");
  }
  const optionExists = poll.options.some((o) => o.id === optionId);
  if (!optionExists) {
    throw new Error("OPTION_NOT_FOUND");
  }
  await database.run("BEGIN TRANSACTION");
  try {
    const existingVote = await database.get(
      "SELECT 1 FROM votes WHERE poll_id = ? AND client_id = ?",
      pollId,
      clientId
    );
    if (existingVote) {
      throw new Error("ALREADY_VOTED");
    }
    await database.run(
      "INSERT INTO votes (poll_id, client_id, option_id) VALUES (?, ?, ?)",
      pollId,
      clientId,
      optionId
    );
    await database.run(
      "UPDATE options SET votes = votes + 1 WHERE id = ? AND poll_id = ?",
      optionId,
      pollId
    );
    await database.run("COMMIT");
  } catch (err) {
    await database.run("ROLLBACK");
    throw err;
  }
  const updatedPoll = await getPoll(pollId);
  if (!updatedPoll) {
    throw new Error("POLL_NOT_FOUND");
  }
  return updatedPoll;
}
async function hasClientVoted(pollId, clientId) {
  const database = await getDb();
  const existingVote = await database.get(
    "SELECT 1 FROM votes WHERE poll_id = ? AND client_id = ?",
    pollId,
    clientId
  );
  return !!existingVote;
}
export {
  castVote as a,
  createPoll as c,
  getPoll as g,
  hasClientVoted as h,
  listAllPolls as l
};
