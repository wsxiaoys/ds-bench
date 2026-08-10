//#region \0tanstack-start-manifest:v
var tsrStartManifest = () => ({ routes: {
	__root__: {
		filePath: "/home/user/project/src/routes/__root.tsx",
		children: [
			"/",
			"/admin",
			"/login"
		],
		preloads: [
			"/assets/index-CERg3mJs.js",
			"/assets/rolldown-runtime-Bh1tDfsg.js",
			"/assets/server-fns-DiY9j7Wi.js",
			"/assets/preload-helper-DgnX2_8r.js"
		],
		scripts: [{ attrs: {
			type: "module",
			async: !0,
			src: "/assets/index-CERg3mJs.js"
		} }]
	},
	"/": {
		filePath: "/home/user/project/src/routes/index.tsx",
		children: void 0,
		preloads: ["/assets/routes-Dy2z5TcE.js"]
	},
	"/admin": {
		filePath: "/home/user/project/src/routes/admin.tsx",
		children: void 0,
		preloads: ["/assets/admin-B9VgH6jo.js"]
	},
	"/login": {
		filePath: "/home/user/project/src/routes/login.tsx",
		children: void 0,
		preloads: ["/assets/login-lGwyFvpx.js"]
	}
} });
//#endregion
export { tsrStartManifest };
