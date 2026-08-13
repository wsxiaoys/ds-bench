import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "../server.js";
import { n as strictQuerySchema } from "./employees-BzqgpZIM.js";
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
//#region src/utils/serverFunctions.ts
var getEmployeesFn = createServerFn({ method: "GET" }).validator((params) => {
	return strictQuerySchema.parse(params);
}).handler(createSsrRpc("466f0b44ce22c89802f405a4cb0e0a7282641b662afd58a7eda66fdb663ffeb6"));
//#endregion
//#region src/routes/index.tsx
var $$splitComponentImporter = () => import("./routes-kzlmgUof.js");
var Route = createFileRoute("/")({
	validateSearch: (search) => {
		const result = strictQuerySchema.safeParse(search);
		if (result.success) return result.data;
		return {
			q: "",
			sort: "id:asc",
			page: 1,
			pageSize: 8
		};
	},
	loaderDeps: ({ search }) => ({
		q: search.q,
		sort: search.sort,
		page: search.page,
		pageSize: search.pageSize
	}),
	loader: async ({ deps }) => {
		return getEmployeesFn({ data: deps });
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
