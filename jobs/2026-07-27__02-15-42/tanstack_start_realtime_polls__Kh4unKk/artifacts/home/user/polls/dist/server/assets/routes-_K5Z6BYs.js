import { t as createServerFn } from "../server.js";
import { t as createSsrRpc } from "./createSsrRpc-BdB2e2iw.js";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
//#region src/routes/index.tsx
var $$splitComponentImporter = () => import("./routes-B4EKnvgF.js");
var getPollsFn = createServerFn({ method: "GET" }).handler(createSsrRpc("bf801b6da52f0361652019d808c8d3bda9fefaad6990b95089c67c421d96fd69"));
var Route = createFileRoute("/")({
	loader: async () => {
		return await getPollsFn();
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
