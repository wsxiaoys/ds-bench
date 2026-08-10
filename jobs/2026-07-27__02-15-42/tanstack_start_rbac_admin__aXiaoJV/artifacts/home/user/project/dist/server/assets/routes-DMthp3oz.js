import { n as getCurrentUserFn } from "./server-fns-qrxJ0EdC.js";
import { createFileRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
//#region src/routes/index.tsx
var $$splitComponentImporter = () => import("./routes-C1DCsULm.js");
var Route = createFileRoute("/")({
	beforeLoad: async () => {
		if (!await getCurrentUserFn()) throw redirect({ to: "/login" });
	},
	loader: async () => {
		return { user: await getCurrentUserFn() };
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
