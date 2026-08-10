import { app, page, route, query, action, api, apiNamespace } from "@wasp.sh/spec";

import { LoginPage } from "./src/pages/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/pages/SignupPage" with { type: "ref" };
import { DashboardPage } from "./src/pages/DashboardPage" with { type: "ref" };
import { FolderPage } from "./src/pages/FolderPage" with { type: "ref" };
import { LogsPage } from "./src/pages/LogsPage" with { type: "ref" };
import { SharePage } from "./src/pages/SharePage" with { type: "ref" };

import { getRootContents } from "./src/queries" with { type: "ref" };
import { getFolderContents } from "./src/queries" with { type: "ref" };
import { getBreadcrumb } from "./src/queries" with { type: "ref" };
import { getShareLinkInfo } from "./src/queries" with { type: "ref" };
import { getAccessLogs } from "./src/queries" with { type: "ref" };

import { createFolder } from "./src/actions" with { type: "ref" };
import { createShareLink } from "./src/actions" with { type: "ref" };

import { configureFileUploadMiddleware, uploadFile } from "./src/apis" with { type: "ref" };
import { downloadFile } from "./src/apis" with { type: "ref" };

export default app({
  name: "app",
  wasp: { version: "^0.25.0" },
  title: "File Manager",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthFailedRedirectTo: "/login",
  },
  spec: [
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),
    route("DashboardRoute", "/", page(DashboardPage, { authRequired: true })),
    route("FolderRoute", "/folder/:folderId", page(FolderPage, { authRequired: true })),
    route("LogsRoute", "/logs", page(LogsPage, { authRequired: true })),
    route("ShareRoute", "/share/:linkId", page(SharePage)),

    query(getRootContents, { entities: ["Folder", "File"] }),
    query(getFolderContents, { entities: ["Folder", "File"] }),
    query(getBreadcrumb, { entities: ["Folder"] }),
    query(getShareLinkInfo, { entities: ["ShareLink"] }),
    query(getAccessLogs, { entities: ["AccessLog", "File"] }),

    action(createFolder, { entities: ["Folder"] }),
    action(createShareLink, { entities: ["ShareLink", "File"] }),

    apiNamespace("/api/upload", { middlewareConfigFn: configureFileUploadMiddleware }),
    api("POST", "/api/upload", uploadFile),
    api("GET", "/api/download/:linkId", downloadFile),
  ],
});
