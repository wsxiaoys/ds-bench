import { t as Route$1 } from "./routes-DghFvbC1.js";
import * as React from "react";
import { HeadContent, Outlet, Scripts, ScrollRestoration, createRootRoute, createRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
//#region src/routes/__root.tsx
var Route = createRootRoute({
	head: () => ({ meta: [
		{ charSet: "utf-8" },
		{
			name: "viewport",
			content: "width=device-width, initial-scale=1"
		},
		{ title: "TanStack Start Kanban" }
	] }),
	component: RootComponent
});
function RootComponent() {
	const [queryClient] = React.useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 1e3 * 60 } } }));
	return /* @__PURE__ */ jsx(RootDocument, { children: /* @__PURE__ */ jsx(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ jsx(Outlet, {})
	}) });
}
function RootDocument({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }), /* @__PURE__ */ jsxs("body", { children: [
			children,
			/* @__PURE__ */ jsx(ScrollRestoration, {}),
			/* @__PURE__ */ jsx(Scripts, {})
		] })]
	});
}
//#endregion
//#region src/routeTree.gen.ts
var rootRouteChildren = { IndexRoute: Route$1.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route
}) };
var routeTree = Route._addFileChildren(rootRouteChildren)._addFileTypes();
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
