import { t as Route$1 } from "./routes-DqpMidD0.js";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext, createRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
//#region src/routes/__root.tsx
var Route = createRootRouteWithContext()({ component: RootComponent });
function RootComponent() {
	const { queryClient } = Route.useRouteContext();
	return /* @__PURE__ */ jsx(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ jsxs("html", {
			lang: "en",
			children: [/* @__PURE__ */ jsxs("head", { children: [
				/* @__PURE__ */ jsx("meta", { charSet: "UTF-8" }),
				/* @__PURE__ */ jsx("meta", {
					name: "viewport",
					content: "width=device-width, initial-scale=1.0"
				}),
				/* @__PURE__ */ jsx("title", { children: "TanStack Start Kanban Board" }),
				/* @__PURE__ */ jsx(HeadContent, {}),
				/* @__PURE__ */ jsx("style", { children: `
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background-color: #f3f4f6;
              color: #1f2937;
            }
            * {
              box-sizing: border-box;
            }
          ` })
			] }), /* @__PURE__ */ jsxs("body", { children: [/* @__PURE__ */ jsx(Outlet, {}), /* @__PURE__ */ jsx(Scripts, {})] })]
		})
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
		context: { queryClient: new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }) },
		scrollRestoration: true
	});
}
//#endregion
export { getRouter };
