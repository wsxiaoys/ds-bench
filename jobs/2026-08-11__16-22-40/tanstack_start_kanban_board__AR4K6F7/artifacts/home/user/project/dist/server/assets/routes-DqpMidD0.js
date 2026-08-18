import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "../server.js";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
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
//#region src/routes/index.tsx?tsr-shared=1
var getBoardFn = createServerFn({ method: "GET" }).handler(createSsrRpc("6c6115329bf8496a120e22b18a35fe363fa042e86294917e292041fcb41640fa"));
//#endregion
//#region src/routes/index.tsx
var $$splitComponentImporter = () => import("./routes-C0E9gUME.js");
var moveCardFn = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("c99c569e04604dc8b039f379f504a828c070a41ce72eda399bf7d18b02317ec6"));
var Route = createFileRoute("/")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData({
			queryKey: ["board"],
			queryFn: () => getBoardFn()
		});
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { moveCardFn as n, getBoardFn as r, Route as t };
