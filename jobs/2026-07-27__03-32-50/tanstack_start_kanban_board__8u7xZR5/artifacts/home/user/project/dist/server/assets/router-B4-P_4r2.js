import { t as Route$2 } from "./routes-BWrjPCwN.js";
import { t as getBoard } from "./db-DPqlf-b6.js";
import { HeadContent, Outlet, Scripts, createFileRoute, createRootRouteWithContext, createRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
//#region src/styles.css?url
var styles_default = "/assets/styles-AKLrb-Re.css";
//#endregion
//#region src/routes/__root.tsx
var Route$1 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "Kanban Board" }
		],
		links: [{
			rel: "stylesheet",
			href: styles_default
		}]
	}),
	component: RootComponent
});
function RootComponent() {
	const { queryClient } = Route$1.useRouteContext();
	return /* @__PURE__ */ jsx(RootDocument, { children: /* @__PURE__ */ jsx(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ jsx(Outlet, {})
	}) });
}
function RootDocument({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }), /* @__PURE__ */ jsxs("body", { children: [children, /* @__PURE__ */ jsx(Scripts, {})] })]
	});
}
//#endregion
//#region src/routes/api/board.ts
var Route = createFileRoute("/api/board")({ server: { handlers: { GET: async () => {
	return Response.json(getBoard());
} } } });
//#endregion
//#region src/routeTree.gen.ts
var rootRouteChildren = {
	IndexRoute: Route$2.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$1
	}),
	ApiBoardRoute: Route.update({
		id: "/api/board",
		path: "/api/board",
		getParentRoute: () => Route$1
	})
};
var routeTree = Route$1._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/router.tsx
function getRouter() {
	return createRouter({
		routeTree,
		scrollRestoration: true,
		context: { queryClient: new QueryClient({ defaultOptions: { queries: { staleTime: 1e3 } } }) }
	});
}
//#endregion
export { getRouter };
