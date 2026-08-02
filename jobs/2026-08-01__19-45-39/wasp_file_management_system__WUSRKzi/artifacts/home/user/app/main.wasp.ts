import { action, api, apiNamespace, app, page, query, route } from "@wasp.sh/spec";

import { LoginPage, SignupPage } from "./src/pages/auth" with { type: "ref" };
import { DashboardPage } from "./src/pages/DashboardPage" with { type: "ref" };
import { LogsPage } from "./src/pages/LogsPage" with { type: "ref" };
import { SharePage } from "./src/pages/SharePage" with { type: "ref" };

import {
  getAccessLogs,
  getFolderContents,
  getShareLinkInfo,
} from "./src/queries" with { type: "ref" };
import {
  createFolder,
  createShareLink,
  unlockShareLink,
} from "./src/actions" with { type: "ref" };
import {
  configureUploadMiddleware,
  downloadFile,
  enableApiCors,
  uploadFile,
} from "./src/apis" with { type: "ref" };

export default app({
  name: "app",
  wasp: { version: "^0.25.0" },
  title: "app",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthFailedRedirectTo: "/login",
  },
  spec: [
    // Auth pages
    route("SignupRoute", "/signup", page(SignupPage)),
    route("LoginRoute", "/login", page(LoginPage)),

    // Dashboard pages
    route("RootRoute", "/", page(DashboardPage, { authRequired: true })),
    route(
      "FolderRoute",
      "/folder/:folderId",
      page(DashboardPage, { authRequired: true }),
    ),

    // Access logs page
    route("LogsRoute", "/logs", page(LogsPage, { authRequired: true })),

    // Public share page
    route("ShareRoute", "/share/:linkId", page(SharePage)),

    // Queries
    query(getFolderContents, { entities: ["Folder", "File"] }),
    query(getAccessLogs, { entities: ["AccessLog"] }),
    query(getShareLinkInfo, { entities: ["ShareLink", "File"], auth: false }),

    // Actions
    action(createFolder, { entities: ["Folder"] }),
    action(createShareLink, { entities: ["File", "ShareLink"] }),
    action(unlockShareLink, { entities: ["ShareLink"], auth: false }),

    // File upload API (multipart, so it can't be a normal Action)
    apiNamespace("/api/upload", { middlewareConfigFn: configureUploadMiddleware }),
    api("POST", "/api/upload", uploadFile, { entities: ["File", "Folder"] }),

    // Public file download API
    apiNamespace("/api/download", { middlewareConfigFn: enableApiCors }),
    api("GET", "/api/download/:linkId", downloadFile, {
      entities: ["ShareLink", "File", "AccessLog"],
      auth: false,
    }),
  ],
});
