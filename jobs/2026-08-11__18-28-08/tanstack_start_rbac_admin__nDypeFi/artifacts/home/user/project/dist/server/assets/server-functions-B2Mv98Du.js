import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "../server.js";
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
//#region src/server-functions.ts
var loginFn = createServerFn({ method: "POST" }).validator(z.object({
	email: z.string().email(),
	password: z.string()
})).handler(createSsrRpc("c20ff3b6a7c2da57de1b8537059b8c2b1899254d8e5dfdd4dfa8439fd7bd24e9"));
var logoutFn = createServerFn({ method: "POST" }).handler(createSsrRpc("855c51e560ffeff260ee783c7cc7059c9a54e16e30ff818e6d24a83a9038c97e"));
var getMeFn = createServerFn({ method: "GET" }).handler(createSsrRpc("fb0f0a5c73d44a5165e66e7565dfbbee5879145b6d60f0810180d7fba2b3239d"));
var setRoleFn = createServerFn({ method: "POST" }).validator(z.object({
	email: z.string().email(),
	role: z.enum(["admin", "user"])
})).handler(createSsrRpc("da048792e6dbc35157af10b2891faa1d56f4a78ca36eca13338e4dfaa9af803d"));
var getUsersFn = createServerFn({ method: "GET" }).handler(createSsrRpc("426cfcdfeec8fa4529959eb51180da426653d0f2df64dc5e3270a567948048ea"));
//#endregion
export { setRoleFn as a, logoutFn as i, getUsersFn as n, loginFn as r, getMeFn as t };
