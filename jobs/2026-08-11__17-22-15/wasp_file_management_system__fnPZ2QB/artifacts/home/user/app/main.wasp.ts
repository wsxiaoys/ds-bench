import { app, page, route, query, action, api } from "@wasp.sh/spec";
import { SignupPage } from "./src/pages/SignupPage" with { type: "ref" };
import { LoginPage } from "./src/pages/LoginPage" with { type: "ref" };
import { MainPage } from "./src/pages/MainPage" with { type: "ref" };
import { FolderPage } from "./src/pages/FolderPage" with { type: "ref" };
import { LogsPage } from "./src/pages/LogsPage" with { type: "ref" };
import { SharePage } from "./src/pages/SharePage" with { type: "ref" };

import { createFolder, createShareLink } from "./src/actions" with { type: "ref" };
import { getFolderContents, getFolderBreadcrumbs, getShareLinkInfo, getAccessLogs, getRunIdQuery } from "./src/queries" with { type: "ref" };
import { uploadFile, downloadFile, configureFileUploadMiddleware } from "./src/apis" with { type: "ref" };

export default app({
  name: "app",
  wasp: { version: "^0.25.0" },
  title: "Wasp Drive",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthFailedRedirectTo: "/login",
  },
  spec: [
    route("SignupRoute", "/signup", page(SignupPage)),
    route("LoginRoute", "/login", page(LoginPage)),
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route("FolderRoute", "/folder/:folderId", page(FolderPage, { authRequired: true })),
    route("LogsRoute", "/logs", page(LogsPage, { authRequired: true })),
    route("ShareRoute", "/share/:linkId", page(SharePage)),

    query(getFolderContents, { entities: ["Folder", "File"] }),
    query(getFolderBreadcrumbs, { entities: ["Folder"] }),
    query(getShareLinkInfo, { entities: ["ShareLink", "File"] }),
    query(getAccessLogs, { entities: ["AccessLog", "File"] }),
    query(getRunIdQuery, { entities: [] }),

    action(createFolder, { entities: ["Folder"] }),
    action(createShareLink, { entities: ["ShareLink", "File"] }),

    api("POST", "/api/upload", uploadFile, {
      middlewareConfigFn: configureFileUploadMiddleware,
      entities: ["File", "Folder"],
    }),
    api("GET", "/api/download/:linkId", downloadFile, {
      entities: ["File", "ShareLink", "AccessLog"],
      auth: false,
    }),
  ],
});
