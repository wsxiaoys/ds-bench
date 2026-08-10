//#region \0tanstack-start-manifest:v
var tsrStartManifest = () => ({ routes: {
	__root__: {
		filePath: "/home/user/polls/src/routes/__root.tsx",
		children: [
			"/",
			"/api/polls",
			"/poll/$id"
		],
		preloads: ["/assets/index-Sz2uDrdR.js"],
		scripts: [{ attrs: {
			type: "module",
			async: !0,
			src: "/assets/index-Sz2uDrdR.js"
		} }]
	},
	"/": {
		filePath: "/home/user/polls/src/routes/index.tsx",
		children: void 0,
		preloads: ["/assets/routes-2KnvPVP1.js"]
	},
	"/poll/$id": {
		filePath: "/home/user/polls/src/routes/poll.$id.tsx",
		children: void 0,
		preloads: ["/assets/poll._id-C34DE-G3.js", "/assets/poll._id-NjSsSQGI.js"]
	}
} });
//#endregion
export { tsrStartManifest };
