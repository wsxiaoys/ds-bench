import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "../server.js";
import { n as moveCard, t as getBoardState } from "./db-D-awr7yx.js";
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
//#region src/serverFunctions.ts?tss-serverfn-split
var getBoardStateFn_createServerFn_handler = createServerRpc({
	id: "e4642b9211f79568b81a5d6c7852350dff5e34c90e45a0ebb32633c72c41247d",
	name: "getBoardStateFn",
	filename: "src/serverFunctions.ts"
}, (opts) => getBoardStateFn.__executeServer(opts));
var getBoardStateFn = createServerFn({ method: "GET" }).handler(getBoardStateFn_createServerFn_handler, async () => {
	return getBoardState();
});
var moveCardFn_createServerFn_handler = createServerRpc({
	id: "d90e23f36ddeb8f9dea5a8e7ffc37d3ac77db82c02bf3f6de94b8c79799fc92f",
	name: "moveCardFn",
	filename: "src/serverFunctions.ts"
}, (opts) => moveCardFn.__executeServer(opts));
var moveCardFn = createServerFn({ method: "POST" }).validator((data) => data).handler(moveCardFn_createServerFn_handler, async ({ data }) => {
	moveCard(data.cardId, data.columnId, data.position);
	return { success: true };
});
//#endregion
export { getBoardStateFn_createServerFn_handler, moveCardFn_createServerFn_handler };
