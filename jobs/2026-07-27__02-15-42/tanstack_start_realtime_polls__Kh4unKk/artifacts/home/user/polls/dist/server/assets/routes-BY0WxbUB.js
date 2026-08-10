import { t as createServerFn } from "../server.js";
import { i as listPolls } from "./db-BEhEHZrU.js";
import { t as createServerRpc } from "./createServerRpc-B0PkXF8x.js";
//#region src/routes/index.tsx?tss-serverfn-split
var getPollsFn_createServerFn_handler = createServerRpc({
	id: "bf801b6da52f0361652019d808c8d3bda9fefaad6990b95089c67c421d96fd69",
	name: "getPollsFn",
	filename: "src/routes/index.tsx"
}, (opts) => getPollsFn.__executeServer(opts));
var getPollsFn = createServerFn({ method: "GET" }).handler(getPollsFn_createServerFn_handler, async () => {
	return await listPolls();
});
//#endregion
export { getPollsFn_createServerFn_handler };
