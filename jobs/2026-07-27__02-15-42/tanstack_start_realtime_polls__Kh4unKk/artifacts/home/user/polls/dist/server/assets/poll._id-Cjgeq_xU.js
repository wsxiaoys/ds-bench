import { t as createServerFn } from "../server.js";
import { r as getPoll } from "./db-BEhEHZrU.js";
import { t as createServerRpc } from "./createServerRpc-B0PkXF8x.js";
//#region src/routes/poll.$id.tsx?tss-serverfn-split
var getPollFn_createServerFn_handler = createServerRpc({
	id: "405264acb5376c9df8501b569b2b8c54f271e88b069188ff31a278b1b41876de",
	name: "getPollFn",
	filename: "src/routes/poll.$id.tsx"
}, (opts) => getPollFn.__executeServer(opts));
var getPollFn = createServerFn({ method: "GET" }).validator((id) => id).handler(getPollFn_createServerFn_handler, async ({ data: id }) => {
	return await getPoll(id);
});
//#endregion
export { getPollFn_createServerFn_handler };
