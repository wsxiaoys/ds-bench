import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "../server.js";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
//#region node_modules/@tanstack/start-server-core/dist/esm/createSsrRpc.js
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
//#endregion
//#region src/server/board.functions.ts
var getBoardFn = createServerFn({ method: "GET" }).handler(createSsrRpc("097e41c17e4f338937b5b11ab8815308add47dcd6312299a712a6dde36a96684"));
var moveCardInput = z.object({
	cardId: z.number().int(),
	toColumnId: z.enum([
		"todo",
		"in-progress",
		"done"
	]),
	toIndex: z.number().int().min(0)
});
var moveCardFn = createServerFn({ method: "POST" }).validator(moveCardInput).handler(createSsrRpc("82e2e39f1a377a03fbb0731d570c0ab65dc5156d8292f5783e78db7b246c9ef9"));
//#endregion
//#region src/routes/index.tsx
var $$splitComponentImporter = () => import("./routes-CNc_ccha.js");
var Route = createFileRoute("/")({
	loader: async () => await getBoardFn(),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { getBoardFn as n, moveCardFn as r, Route as t };
