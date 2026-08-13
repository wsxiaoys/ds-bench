import { n as strictQuerySchema, t as queryEmployees } from "./employees-BzqgpZIM.js";
import { t as Route$2 } from "./routes-sUmzZAng.js";
import "react";
import { HeadContent, Outlet, Scripts, ScrollRestoration, createFileRoute, createRootRoute, createRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/__root.tsx
var Route$1 = createRootRoute({
	meta: () => [
		{ charSet: "utf-8" },
		{
			name: "viewport",
			content: "width=device-width, initial-scale=1"
		},
		{ title: "Server-Driven Employee Data Grid" }
	],
	component: RootComponent
});
function RootComponent() {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }), /* @__PURE__ */ jsxs("body", { children: [
			/* @__PURE__ */ jsx(Outlet, {}),
			/* @__PURE__ */ jsx(ScrollRestoration, {}),
			/* @__PURE__ */ jsx(Scripts, {})
		] })]
	});
}
//#endregion
//#region src/routes/api.employees.ts
var Route = createFileRoute("/api/employees")({ server: { handlers: { GET: async ({ request }) => {
	const url = new URL(request.url);
	const params = Object.fromEntries(url.searchParams.entries());
	const result = strictQuerySchema.safeParse(params);
	if (!result.success) {
		const errorMsg = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
		return Response.json({ error: errorMsg }, { status: 400 });
	}
	const data = queryEmployees(result.data);
	return Response.json(data);
} } } });
//#endregion
//#region src/routeTree.gen.ts
var rootRouteChildren = {
	IndexRoute: Route$2.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$1
	}),
	ApiEmployeesRoute: Route.update({
		id: "/api/employees",
		path: "/api/employees",
		getParentRoute: () => Route$1
	})
};
var routeTree = Route$1._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/router.tsx
function getRouter() {
	return createRouter({
		routeTree,
		scrollRestoration: true
	});
}
//#endregion
export { getRouter };
