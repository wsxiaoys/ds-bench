import { t as createServerFn } from "../server.js";
import { t as createSsrRpc } from "./createSsrRpc-BdB2e2iw.js";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
//#region src/routes/poll.$id.tsx
var $$splitErrorComponentImporter = () => import("./poll._id-81Mqy_uN.js");
var $$splitComponentImporter = () => import("./poll._id-CFeW0zOj.js");
var getPollFn = createServerFn({ method: "GET" }).validator((id) => id).handler(createSsrRpc("405264acb5376c9df8501b569b2b8c54f271e88b069188ff31a278b1b41876de"));
var Route = createFileRoute("/poll/$id")({
	loader: async ({ params }) => {
		const poll = await getPollFn({ data: params.id });
		if (!poll) throw new Error("Poll not found");
		return poll;
	},
	component: lazyRouteComponent($$splitComponentImporter, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter, "errorComponent")
});
//#endregion
export { Route as t };
