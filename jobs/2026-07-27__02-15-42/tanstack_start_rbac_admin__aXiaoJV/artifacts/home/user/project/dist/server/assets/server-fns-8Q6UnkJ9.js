import { a as getCookie, i as deleteCookie, n as TSS_SERVER_FUNCTION, o as setCookie, s as setResponseStatus, t as createServerFn } from "../server.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
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
var dbDir = "/home/user/project/data";
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
var db = new Database(path.join(dbDir, "app.sqlite"));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )
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
	const insertUser = db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)");
	for (const u of seedUsers) {
		const salt = bcrypt.genSaltSync(10);
		const hash = bcrypt.hashSync(u.password, salt);
		insertUser.run(u.email, hash, u.role);
	}
}
//#endregion
//#region src/auth.ts
function getUserByEmail(email) {
	const user = db.prepare("SELECT email, role FROM users WHERE email = ?").get(email);
	if (!user) return null;
	return {
		email: user.email,
		role: user.role
	};
}
function getAllUsers() {
	return db.prepare("SELECT email, role FROM users ORDER BY email ASC").all();
}
function verifyUserPassword(email, password) {
	const user = db.prepare("SELECT email, password_hash, role FROM users WHERE email = ?").get(email);
	if (!user) return null;
	if (!bcrypt.compareSync(password, user.password_hash)) return null;
	return {
		email: user.email,
		role: user.role
	};
}
function createSession(email, role) {
	const sessionId = crypto.randomUUID();
	const expiresAt = Date.now() + 1440 * 60 * 1e3;
	db.prepare("INSERT INTO sessions (id, email, role, expires_at) VALUES (?, ?, ?, ?)").run(sessionId, email, role, expiresAt);
	return sessionId;
}
function getSession(sessionId) {
	if (!sessionId) return null;
	const session = db.prepare("SELECT email, role, expires_at FROM sessions WHERE id = ?").get(sessionId);
	if (!session) return null;
	if (Date.now() > session.expires_at) {
		db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
		return null;
	}
	return {
		email: session.email,
		role: session.role
	};
}
function deleteSession(sessionId) {
	if (!sessionId) return;
	db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}
function updateUserRole(email, role) {
	if (db.prepare("UPDATE users SET role = ? WHERE email = ?").run(role, email).changes === 0) return false;
	db.prepare("UPDATE sessions SET role = ? WHERE email = ?").run(role, email);
	return true;
}
//#endregion
//#region src/server-fns.ts?tss-serverfn-split
var getCurrentUserFn_createServerFn_handler = createServerRpc({
	id: "9d8b050d3b1996a9926d5b0afb1e1ba9a8f13680732b618cfd1f8e564362fa5d",
	name: "getCurrentUserFn",
	filename: "src/server-fns.ts"
}, (opts) => getCurrentUserFn.__executeServer(opts));
var getCurrentUserFn = createServerFn({ method: "GET" }).handler(getCurrentUserFn_createServerFn_handler, async () => {
	return getSession(getCookie("rbac_session"));
});
var loginFn_createServerFn_handler = createServerRpc({
	id: "974e9273fa29e7c852c46e5e938feb04504741d93d16be5c3afb9ce7f9ca2eb6",
	name: "loginFn",
	filename: "src/server-fns.ts"
}, (opts) => loginFn.__executeServer(opts));
var loginFn = createServerFn({ method: "POST" }).validator((data) => data).handler(loginFn_createServerFn_handler, async ({ data }) => {
	const { email, password } = data;
	const user = verifyUserPassword(email, password);
	if (!user) throw new Error("Invalid credentials");
	setCookie("rbac_session", createSession(user.email, user.role), {
		httpOnly: true,
		sameSite: "lax",
		path: "/"
	});
	return user;
});
var logoutFn_createServerFn_handler = createServerRpc({
	id: "3abea60a6da065c01385b0a8c0a91902bf575b973cc5aeceb404cb7cdc8f852a",
	name: "logoutFn",
	filename: "src/server-fns.ts"
}, (opts) => logoutFn.__executeServer(opts));
var logoutFn = createServerFn({ method: "POST" }).handler(logoutFn_createServerFn_handler, async () => {
	const sessionId = getCookie("rbac_session");
	if (sessionId) deleteSession(sessionId);
	deleteCookie("rbac_session", { path: "/" });
	return { success: true };
});
var getAllUsersFn_createServerFn_handler = createServerRpc({
	id: "de0e1042153f13710646978b1cce604c04f265b36b783d0e36692a7d24f7d166",
	name: "getAllUsersFn",
	filename: "src/server-fns.ts"
}, (opts) => getAllUsersFn.__executeServer(opts));
var getAllUsersFn = createServerFn({ method: "GET" }).handler(getAllUsersFn_createServerFn_handler, async () => {
	const user = getSession(getCookie("rbac_session"));
	if (!user) {
		setResponseStatus(401);
		throw new Error("Unauthorized");
	}
	if (user.role !== "admin") {
		setResponseStatus(403);
		throw new Error("Forbidden");
	}
	return getAllUsers();
});
var setRoleFn_createServerFn_handler = createServerRpc({
	id: "97909c746966a2933873df3ab054002913dab37e5ac83824d859f11cbdbf0760",
	name: "setRoleFn",
	filename: "src/server-fns.ts"
}, (opts) => setRoleFn.__executeServer(opts));
var setRoleFn = createServerFn({ method: "POST" }).validator((data) => data).handler(setRoleFn_createServerFn_handler, async ({ data }) => {
	const user = getSession(getCookie("rbac_session"));
	if (!user) {
		setResponseStatus(401);
		return {
			error: "Unauthorized",
			status: 401
		};
	}
	if (user.role !== "admin") {
		setResponseStatus(403);
		return {
			error: "Forbidden",
			status: 403
		};
	}
	const { email, role } = data;
	if (!getUserByEmail(email)) {
		setResponseStatus(404);
		return {
			error: "User not found",
			status: 404
		};
	}
	updateUserRole(email, role);
	return { user: {
		email,
		role
	} };
});
//#endregion
export { getAllUsersFn_createServerFn_handler, getCurrentUserFn_createServerFn_handler, loginFn_createServerFn_handler, logoutFn_createServerFn_handler, setRoleFn_createServerFn_handler };
