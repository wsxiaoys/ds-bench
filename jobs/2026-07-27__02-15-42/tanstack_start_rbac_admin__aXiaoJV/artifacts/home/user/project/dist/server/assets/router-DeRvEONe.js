import { n as getCurrentUserFn } from "./server-fns-qrxJ0EdC.js";
import { t as Route$2 } from "./routes-DMthp3oz.js";
import { t as Route$3 } from "./admin-BT7zRFy2.js";
import { HeadContent, Outlet, Scripts, createFileRoute, createRootRoute, createRouter, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/__root.tsx
var Route$1 = createRootRoute({
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
	return /* @__PURE__ */ jsxs("html", { children: [/* @__PURE__ */ jsxs("head", { children: [/* @__PURE__ */ jsx(HeadContent, {}), /* @__PURE__ */ jsx("style", { children: `
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f3f4f6;
            color: #111827;
          }
          * {
            box-sizing: border-box;
          }
        ` })] }), /* @__PURE__ */ jsxs("body", { children: [children, /* @__PURE__ */ jsx(Scripts, {})] })] });
}
//#endregion
//#region src/routes/login.tsx
var $$splitComponentImporter = () => import("./login-Dpw9IrEJ.js");
var Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const user = await getCurrentUserFn();
		if (user) if (user.role === "admin") throw redirect({ to: "/admin" });
		else throw redirect({ to: "/" });
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
//#region src/routeTree.gen.ts
var rootRouteChildren = {
	IndexRoute: Route$2.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$1
	}),
	AdminRoute: Route$3.update({
		id: "/admin",
		path: "/admin",
		getParentRoute: () => Route$1
	}),
	LoginRoute: Route.update({
		id: "/login",
		path: "/login",
		getParentRoute: () => Route$1
	})
};
var routeTree = Route$1._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/router.tsx
function getRouter() {
	return createRouter({ routeTree });
}
//#endregion
export { getRouter };
