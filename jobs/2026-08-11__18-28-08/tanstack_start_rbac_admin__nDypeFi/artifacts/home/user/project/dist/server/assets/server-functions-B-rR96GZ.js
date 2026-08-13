import { a as setResponseHeader, i as getRequestHeader, n as TSS_SERVER_FUNCTION, o as setResponseStatus, t as createServerFn } from "../server.js";
import { a as deleteSession, i as db, r as createSession, t as getSessionFromCookie } from "./auth-ChhWAiQu.js";
import { z } from "zod";
import bcrypt from "bcryptjs";
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
//#region src/server-functions.ts?tss-serverfn-split
var loginFn_createServerFn_handler = createServerRpc({
	id: "c20ff3b6a7c2da57de1b8537059b8c2b1899254d8e5dfdd4dfa8439fd7bd24e9",
	name: "loginFn",
	filename: "src/server-functions.ts"
}, (opts) => loginFn.__executeServer(opts));
var loginFn = createServerFn({ method: "POST" }).validator(z.object({
	email: z.string().email(),
	password: z.string()
})).handler(loginFn_createServerFn_handler, async ({ data }) => {
	const { email, password } = data;
	const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
	if (!user) {
		setResponseStatus(401);
		throw new Error("Invalid credentials");
	}
	if (!bcrypt.compareSync(password, user.password_hash)) {
		setResponseStatus(401);
		throw new Error("Invalid credentials");
	}
	const { token, expiresAt } = createSession(user.id);
	setResponseHeader("Set-Cookie", `rbac_session=${token}; HttpOnly; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}`);
	return {
		email: user.email,
		role: user.role
	};
});
var logoutFn_createServerFn_handler = createServerRpc({
	id: "855c51e560ffeff260ee783c7cc7059c9a54e16e30ff818e6d24a83a9038c97e",
	name: "logoutFn",
	filename: "src/server-functions.ts"
}, (opts) => logoutFn.__executeServer(opts));
var logoutFn = createServerFn({ method: "POST" }).handler(logoutFn_createServerFn_handler, async () => {
	const cookieHeader = getRequestHeader("cookie");
	let token = "";
	if (cookieHeader) token = cookieHeader.split(";").reduce((acc, cookie) => {
		const [key, ...value] = cookie.trim().split("=");
		if (key) acc[key] = value.join("=");
		return acc;
	}, {})["rbac_session"] || "";
	if (token) deleteSession(token);
	setResponseHeader("Set-Cookie", "rbac_session=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
	return { ok: true };
});
var getMeFn_createServerFn_handler = createServerRpc({
	id: "fb0f0a5c73d44a5165e66e7565dfbbee5879145b6d60f0810180d7fba2b3239d",
	name: "getMeFn",
	filename: "src/server-functions.ts"
}, (opts) => getMeFn.__executeServer(opts));
var getMeFn = createServerFn({ method: "GET" }).handler(getMeFn_createServerFn_handler, async () => {
	const session = getSessionFromCookie();
	if (!session) return null;
	return {
		email: session.user.email,
		role: session.user.role
	};
});
var setRoleFn_createServerFn_handler = createServerRpc({
	id: "da048792e6dbc35157af10b2891faa1d56f4a78ca36eca13338e4dfaa9af803d",
	name: "setRoleFn",
	filename: "src/server-functions.ts"
}, (opts) => setRoleFn.__executeServer(opts));
var setRoleFn = createServerFn({ method: "POST" }).validator(z.object({
	email: z.string().email(),
	role: z.enum(["admin", "user"])
})).handler(setRoleFn_createServerFn_handler, async ({ data }) => {
	const session = getSessionFromCookie();
	if (!session) {
		setResponseStatus(401);
		throw new Error("Unauthorized");
	}
	if (session.user.role !== "admin") {
		setResponseStatus(403);
		throw new Error("Forbidden");
	}
	const { email, role } = data;
	if (!db.prepare("SELECT * FROM users WHERE email = ?").get(email)) {
		setResponseStatus(404);
		throw new Error("User not found");
	}
	db.prepare("UPDATE users SET role = ? WHERE email = ?").run(role, email);
	return {
		email,
		role
	};
});
var getUsersFn_createServerFn_handler = createServerRpc({
	id: "426cfcdfeec8fa4529959eb51180da426653d0f2df64dc5e3270a567948048ea",
	name: "getUsersFn",
	filename: "src/server-functions.ts"
}, (opts) => getUsersFn.__executeServer(opts));
var getUsersFn = createServerFn({ method: "GET" }).handler(getUsersFn_createServerFn_handler, async () => {
	const session = getSessionFromCookie();
	if (!session) {
		setResponseStatus(401);
		throw new Error("Unauthorized");
	}
	if (session.user.role !== "admin") {
		setResponseStatus(403);
		throw new Error("Forbidden");
	}
	return db.prepare("SELECT email, role FROM users").all();
});
//#endregion
export { getMeFn_createServerFn_handler, getUsersFn_createServerFn_handler, loginFn_createServerFn_handler, logoutFn_createServerFn_handler, setRoleFn_createServerFn_handler };
