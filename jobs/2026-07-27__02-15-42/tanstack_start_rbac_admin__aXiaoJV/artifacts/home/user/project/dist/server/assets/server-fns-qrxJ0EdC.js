import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "../server.js";
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
//#region src/server-fns.ts
var getCurrentUserFn = createServerFn({ method: "GET" }).handler(createSsrRpc("9d8b050d3b1996a9926d5b0afb1e1ba9a8f13680732b618cfd1f8e564362fa5d"));
var loginFn = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("974e9273fa29e7c852c46e5e938feb04504741d93d16be5c3afb9ce7f9ca2eb6"));
var logoutFn = createServerFn({ method: "POST" }).handler(createSsrRpc("3abea60a6da065c01385b0a8c0a91902bf575b973cc5aeceb404cb7cdc8f852a"));
var getAllUsersFn = createServerFn({ method: "GET" }).handler(createSsrRpc("de0e1042153f13710646978b1cce604c04f265b36b783d0e36692a7d24f7d166"));
var setRoleFn = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("97909c746966a2933873df3ab054002913dab37e5ac83824d859f11cbdbf0760"));
//#endregion
export { setRoleFn as a, logoutFn as i, getCurrentUserFn as n, loginFn as r, getAllUsersFn as t };
