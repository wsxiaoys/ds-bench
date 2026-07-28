import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "../server.js";
import { n as moveCard, t as getBoard } from "./db-DPqlf-b6.js";
import { z } from "zod";
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
//#region src/server/board.functions.ts?tss-serverfn-split
var getBoardFn_createServerFn_handler = createServerRpc({
	id: "097e41c17e4f338937b5b11ab8815308add47dcd6312299a712a6dde36a96684",
	name: "getBoardFn",
	filename: "src/server/board.functions.ts"
}, (opts) => getBoardFn.__executeServer(opts));
var getBoardFn = createServerFn({ method: "GET" }).handler(getBoardFn_createServerFn_handler, async () => {
	return getBoard();
});
var moveCardInput = z.object({
	cardId: z.number().int(),
	toColumnId: z.enum([
		"todo",
		"in-progress",
		"done"
	]),
	toIndex: z.number().int().min(0)
});
var moveCardFn_createServerFn_handler = createServerRpc({
	id: "82e2e39f1a377a03fbb0731d570c0ab65dc5156d8292f5783e78db7b246c9ef9",
	name: "moveCardFn",
	filename: "src/server/board.functions.ts"
}, (opts) => moveCardFn.__executeServer(opts));
var moveCardFn = createServerFn({ method: "POST" }).validator(moveCardInput).handler(moveCardFn_createServerFn_handler, async ({ data }) => {
	return moveCard(data.cardId, data.toColumnId, data.toIndex);
});
//#endregion
export { getBoardFn_createServerFn_handler, moveCardFn_createServerFn_handler };
