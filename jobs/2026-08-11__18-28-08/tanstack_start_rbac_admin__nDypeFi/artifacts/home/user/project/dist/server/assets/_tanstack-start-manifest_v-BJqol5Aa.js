//#region \0tanstack-start-manifest:v
var tsrStartManifest = () => ({ routes: {
	__root__: {
		filePath: "/home/user/project/src/routes/__root.tsx",
		children: [
			"/",
			"/admin",
			"/login",
			"/api/login",
			"/api/logout",
			"/api/me",
			"/api/admin/set-role",
			"/api/admin/users"
		],
		preloads: [
			"/assets/index-BZqC3sox.js",
			"/assets/rolldown-runtime-Bh1tDfsg.js",
			"/assets/server-functions-CkqpGt2e.js",
			"/assets/admin-Be59K7Fw.js"
		],
		scripts: [{ attrs: {
			type: "module",
			async: !0,
			src: "/assets/index-BZqC3sox.js"
		} }]
	},
	"/admin": {
		filePath: "/home/user/project/src/routes/admin.tsx",
		children: void 0,
		preloads: ["/assets/admin-EaoAPDQO.js"]
	},
	"/login": {
		filePath: "/home/user/project/src/routes/login.tsx",
		children: void 0,
		preloads: ["/assets/login-sAgaW8F8.js"]
	}
} });
//#endregion
export { tsrStartManifest };
