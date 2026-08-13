import { n as getUsersFn, t as getMeFn } from "./server-functions-B2Mv98Du.js";
import { createFileRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
//#region src/routes/admin.tsx
var $$splitComponentImporter = () => import("./admin-DEcxXBZA.js");
var Route = createFileRoute("/admin")({
	beforeLoad: async () => {
		const user = await getMeFn();
		if (!user) throw redirect({ to: "/login" });
		if (user.role !== "admin") throw redirect({ to: "/login" });
		return { user };
	},
	loader: async () => {
		return { users: await getUsersFn() };
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
