import { i as getRequestHeader } from "../server.js";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
//#region src/db.ts
var dbDir = "/home/user/project/data";
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
var db = new Database(path.join(dbDir, "app.sqlite"));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);
if (db.prepare("SELECT COUNT(*) as count FROM users").get().count === 0) {
	const seedUsers = [
		{
			email: "root@example.com",
			password: "Adm1n!pass9",
			role: "admin"
		},
		{
			email: "member@example.com",
			password: "Us3r!pass42",
			role: "user"
		},
		{
			email: "pat@example.com",
			password: "Us3r!pass42",
			role: "user"
		},
		{
			email: "sam@example.com",
			password: "Us3r!pass42",
			role: "user"
		},
		{
			email: "jordan@example.com",
			password: "Us3r!pass42",
			role: "user"
		}
	];
	const insert = db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)");
	for (const user of seedUsers) {
		const salt = bcrypt.genSaltSync(10);
		const hash = bcrypt.hashSync(user.password, salt);
		insert.run(user.email, hash, user.role);
	}
}
function createSession(userId) {
	const token = randomUUID();
	const expiresAt = new Date(Date.now() + 1440 * 60 * 1e3);
	db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt.getTime());
	return {
		token,
		expiresAt
	};
}
function getSession(token) {
	const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(token);
	if (!session) return null;
	if (Date.now() > session.expires_at) {
		db.prepare("DELETE FROM sessions WHERE id = ?").run(token);
		return null;
	}
	const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id);
	if (!user) return null;
	return { user };
}
function deleteSession(token) {
	db.prepare("DELETE FROM sessions WHERE id = ?").run(token);
}
//#endregion
//#region src/utils/auth.ts
function getSessionFromRequest(request) {
	const cookieHeader = request.headers.get("cookie");
	if (!cookieHeader) return null;
	const token = cookieHeader.split(";").reduce((acc, cookie) => {
		const [key, ...value] = cookie.trim().split("=");
		if (key) acc[key] = value.join("=");
		return acc;
	}, {})["rbac_session"];
	if (!token) return null;
	return getSession(token);
}
function getSessionFromCookie() {
	const cookieHeader = getRequestHeader("cookie");
	if (!cookieHeader) return null;
	const token = cookieHeader.split(";").reduce((acc, cookie) => {
		const [key, ...value] = cookie.trim().split("=");
		if (key) acc[key] = value.join("=");
		return acc;
	}, {})["rbac_session"];
	if (!token) return null;
	return getSession(token);
}
//#endregion
export { deleteSession as a, db as i, getSessionFromRequest as n, createSession as r, getSessionFromCookie as t };
