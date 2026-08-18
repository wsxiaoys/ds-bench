import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "../server.js";
//#region node_modules/@tanstack/start-server-core/dist/esm/createServerRpc.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
//#endregion
//#region src/routes/index.tsx?tss-serverfn-split
var getBoardFn_createServerFn_handler = createServerRpc({
	id: "6c6115329bf8496a120e22b18a35fe363fa042e86294917e292041fcb41640fa",
	name: "getBoardFn",
	filename: "src/routes/index.tsx"
}, (opts) => getBoardFn.__executeServer(opts));
var getBoardFn = createServerFn({ method: "GET" }).handler(getBoardFn_createServerFn_handler, async () => {
	const { getBoard } = await import("./db.server-D2OUimuK.js");
	return getBoard();
});
var moveCardFn_createServerFn_handler = createServerRpc({
	id: "c99c569e04604dc8b039f379f504a828c070a41ce72eda399bf7d18b02317ec6",
	name: "moveCardFn",
	filename: "src/routes/index.tsx"
}, (opts) => moveCardFn.__executeServer(opts));
var moveCardFn = createServerFn({ method: "POST" }).validator((data) => data).handler(moveCardFn_createServerFn_handler, async ({ data }) => {
	const { moveCard } = await import("./db.server-D2OUimuK.js");
	moveCard(data.cardId, data.toColumn, data.toPosition);
	return { success: true };
});
//#endregion
export { getBoardFn_createServerFn_handler, moveCardFn_createServerFn_handler };
