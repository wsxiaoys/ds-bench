import { app, page, route, query, action, api } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { FolderPage } from "./src/FolderPage" with { type: "ref" };
import { LogsPage } from "./src/LogsPage" with { type: "ref" };
import { SharePage } from "./src/SharePage" with { type: "ref" };
import { LoginPage } from "./src/auth/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/auth/SignupPage" with { type: "ref" };

// Operations
import { getFolders, getFiles, getFolderBreadcrumbs, getFolderDetails, getAccessLogs, getPublicShareLink } from "./src/queries" with { type: "ref" };
import { createFolder, uploadFile, createShareLink } from "./src/actions" with { type: "ref" };

// API Endpoints
import { downloadFile } from "./src/apis" with { type: "ref" };

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
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route("FolderRoute", "/folder/:folderId", page(FolderPage, { authRequired: true })),
    route("LogsRoute", "/logs", page(LogsPage, { authRequired: true })),
    route("ShareRoute", "/share/:linkId", page(SharePage)),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),

    // Queries
    query(getFolders, { entities: ["Folder"] }),
    query(getFiles, { entities: ["File"] }),
    query(getFolderBreadcrumbs, { entities: ["Folder"] }),
    query(getFolderDetails, { entities: ["Folder"] }),
    query(getAccessLogs, { entities: ["AccessLog", "File"] }),
    query(getPublicShareLink, { entities: ["ShareLink", "File"] }),

    // Actions
    action(createFolder, { entities: ["Folder"] }),
    action(uploadFile, { entities: ["File", "Folder"] }),
    action(createShareLink, { entities: ["ShareLink", "File"] }),

    // Custom API Endpoint
    api("GET", "/api/download/:linkId", downloadFile, { entities: ["ShareLink", "File", "AccessLog"], auth: false }),
  ],
});
