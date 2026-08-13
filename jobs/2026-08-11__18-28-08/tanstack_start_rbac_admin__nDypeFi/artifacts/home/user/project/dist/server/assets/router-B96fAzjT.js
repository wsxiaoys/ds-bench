import { t as getMeFn } from "./server-functions-B2Mv98Du.js";
import { t as Route$8 } from "./admin-D1SAo_nc.js";
import { a as deleteSession, i as db, n as getSessionFromRequest, r as createSession } from "./auth-ChhWAiQu.js";
import { HeadContent, Outlet, Scripts, createFileRoute, createRootRoute, createRouter as createRouter$1, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import bcrypt from "bcryptjs";
//#region src/routes/__root.tsx
var Route$7 = createRootRoute({
	head: () => ({ meta: [
		{ charSet: "utf-8" },
		{
			name: "viewport",
			content: "width=device-width, initial-scale=1"
		},
		{ title: "RBAC Admin Console" }
	] }),
	component: RootComponent
});
function RootComponent() {
	return /* @__PURE__ */ jsx(RootDocument, { children: /* @__PURE__ */ jsx(Outlet, {}) });
}
function RootDocument({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }), /* @__PURE__ */ jsxs("body", {
			style: {
				margin: 0,
				fontFamily: "sans-serif",
				backgroundColor: "#f9fafb",
				color: "#111827"
			},
			children: [/* @__PURE__ */ jsx("div", {
				style: {
					minHeight: "100vh",
					display: "flex",
					flexDirection: "column"
				},
				children
			}), /* @__PURE__ */ jsx(Scripts, {})]
		})]
	});
}
//#endregion
//#region src/routes/index.tsx
var Route$6 = createFileRoute("/")({ beforeLoad: async () => {
	const user = await getMeFn();
	if (user && user.role === "admin") throw redirect({ to: "/admin" });
	else throw redirect({ to: "/login" });
} });
//#endregion
//#region src/routes/login.tsx
var $$splitComponentImporter = () => import("./login-BAOK8yMX.js");
var Route$5 = createFileRoute("/login")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
//#endregion
//#region src/routes/api/login.ts
var Route$4 = createFileRoute("/api/login")({ server: { handlers: { POST: async ({ request }) => {
	try {
		const { email, password } = await request.json();
		if (typeof email !== "string" || typeof password !== "string") return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
		const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
		if (!user) return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
		if (!bcrypt.compareSync(password, user.password_hash)) return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
		const { token, expiresAt } = createSession(user.id);
		const headers = new Headers();
		headers.append("Set-Cookie", `rbac_session=${token}; HttpOnly; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}`);
		return Response.json({ user: {
			email: user.email,
			role: user.role
		} }, { headers });
	} catch (err) {
		return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
	}
} } } });
//#endregion
//#region src/routes/api/logout.ts
var Route$3 = createFileRoute("/api/logout")({ server: { handlers: { POST: async ({ request }) => {
	const cookieHeader = request.headers.get("cookie");
	let token = "";
	if (cookieHeader) token = cookieHeader.split(";").reduce((acc, cookie) => {
		const [key, ...value] = cookie.trim().split("=");
		if (key) acc[key] = value.join("=");
		return acc;
	}, {})["rbac_session"] || "";
	if (token) deleteSession(token);
	const headers = new Headers();
	headers.append("Set-Cookie", "rbac_session=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
	return Response.json({ ok: true }, { headers });
} } } });
//#endregion
//#region src/routes/api/me.ts
var Route$2 = createFileRoute("/api/me")({ server: { handlers: { GET: async ({ request }) => {
	const session = getSessionFromRequest(request);
	if (!session) return Response.json({ user: null }, { status: 401 });
	return Response.json({ user: {
		email: session.user.email,
		role: session.user.role
	} });
} } } });
//#endregion
//#region src/routes/api/admin/set-role.ts
var Route$1 = createFileRoute("/api/admin/set-role")({ server: { handlers: { POST: async ({ request }) => {
	const session = getSessionFromRequest(request);
	if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
	if (session.user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
	try {
		const { email, role } = await request.json();
		if (typeof email !== "string" || typeof role !== "string") return Response.json({ error: "Invalid input" }, { status: 400 });
		if (role !== "admin" && role !== "user") return Response.json({ error: "Invalid role" }, { status: 400 });
		if (!db.prepare("SELECT * FROM users WHERE email = ?").get(email)) return Response.json({ error: "User not found" }, { status: 404 });
		db.prepare("UPDATE users SET role = ? WHERE email = ?").run(role, email);
		return Response.json({ user: {
			email,
			role
		} });
	} catch (err) {
		return Response.json({ error: "Internal Server Error" }, { status: 500 });
	}
} } } });
//#endregion
//#region src/routes/api/admin/users.ts
var Route = createFileRoute("/api/admin/users")({ server: { handlers: { GET: async ({ request }) => {
	const session = getSessionFromRequest(request);
	if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
	if (session.user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
	const users = db.prepare("SELECT email, role FROM users").all();
	return Response.json({ users });
} } } });
//#endregion
//#region src/routeTree.gen.ts
var rootRouteChildren = {
	IndexRoute: Route$6.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$7
	}),
	AdminRoute: Route$8.update({
		id: "/admin",
		path: "/admin",
		getParentRoute: () => Route$7
	}),
	LoginRoute: Route$5.update({
		id: "/login",
		path: "/login",
		getParentRoute: () => Route$7
	}),
	ApiLoginRoute: Route$4.update({
		id: "/api/login",
		path: "/api/login",
		getParentRoute: () => Route$7
	}),
	ApiLogoutRoute: Route$3.update({
		id: "/api/logout",
		path: "/api/logout",
		getParentRoute: () => Route$7
	}),
	ApiMeRoute: Route$2.update({
		id: "/api/me",
		path: "/api/me",
		getParentRoute: () => Route$7
	}),
	ApiAdminSetRoleRoute: Route$1.update({
		id: "/api/admin/set-role",
		path: "/api/admin/set-role",
		getParentRoute: () => Route$7
	}),
	ApiAdminUsersRoute: Route.update({
		id: "/api/admin/users",
		path: "/api/admin/users",
		getParentRoute: () => Route$7
	})
};
var routeTree = Route$7._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/router.tsx
function createRouter() {
	return createRouter$1({ routeTree });
}
var getRouter = createRouter;
//#endregion
export { createRouter, getRouter };
