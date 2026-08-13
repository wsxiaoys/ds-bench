import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "../server.js";
import { n as strictQuerySchema, t as queryEmployees } from "./employees-BzqgpZIM.js";
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
//#region src/utils/serverFunctions.ts?tss-serverfn-split
var getEmployeesFn_createServerFn_handler = createServerRpc({
	id: "466f0b44ce22c89802f405a4cb0e0a7282641b662afd58a7eda66fdb663ffeb6",
	name: "getEmployeesFn",
	filename: "src/utils/serverFunctions.ts"
}, (opts) => getEmployeesFn.__executeServer(opts));
var getEmployeesFn = createServerFn({ method: "GET" }).validator((params) => {
	return strictQuerySchema.parse(params);
}).handler(getEmployeesFn_createServerFn_handler, async ({ data }) => {
	return queryEmployees(data);
});
//#endregion
export { getEmployeesFn_createServerFn_handler };
