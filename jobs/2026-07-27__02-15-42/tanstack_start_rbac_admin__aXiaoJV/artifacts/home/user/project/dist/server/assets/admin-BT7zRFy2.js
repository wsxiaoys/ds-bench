import { n as getCurrentUserFn, t as getAllUsersFn } from "./server-fns-qrxJ0EdC.js";
import { createFileRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
//#region src/routes/admin.tsx
var $$splitComponentImporter = () => import("./admin-QyIQ68xj.js");
var Route = createFileRoute("/admin")({
	beforeLoad: async () => {
		const user = await getCurrentUserFn();
		if (!user) throw redirect({ to: "/login" });
		if (user.role !== "admin") throw redirect({ to: "/" });
	},
	loader: async () => {
		return { users: await getAllUsersFn() };
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
