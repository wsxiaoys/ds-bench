import { app, page, route, query, action, api } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage } from "./src/auth/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/auth/SignupPage" with { type: "ref" };
import { FolderPage } from "./src/pages/FolderPage" with { type: "ref" };
import { LogsPage } from "./src/pages/LogsPage" with { type: "ref" };
import { SharePage } from "./src/pages/SharePage" with { type: "ref" };
import { getFolderContents, getAccessLogs, getShareLinkDetails, verifySharePassword } from "./src/queries" with { type: "ref" };
import { createFolder, createShareLink } from "./src/actions" with { type: "ref" };
import { downloadFile, uploadFile } from "./src/apis" with { type: "ref" };

export default app({
  name: "app",
  wasp: { version: "^0.25.0" },
  title: "Wasp File Management System",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthFailedRedirectTo: "/login",
  },
  spec: [
    // Routes and Pages
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route("FolderRoute", "/folder/:folderId", page(FolderPage, { authRequired: true })),
    route("LogsRoute", "/logs", page(LogsPage, { authRequired: true })),
    route("ShareRoute", "/share/:linkId", page(SharePage)),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),

    // Queries
    query(getFolderContents, { entities: ["Folder", "File"] }),
    query(getAccessLogs, { entities: ["AccessLog", "ShareLink", "File"] }),
    query(getShareLinkDetails, { entities: ["ShareLink", "File"] }),
    query(verifySharePassword, { entities: ["ShareLink"] }),

    // Actions
    action(createFolder, { entities: ["Folder"] }),
    action(createShareLink, { entities: ["ShareLink", "File"] }),

    // API Endpoints
    api("GET", "/api/download/:linkId", downloadFile, { entities: ["ShareLink", "AccessLog", "File"], auth: false }),
    api("POST", "/api/upload", uploadFile, { entities: ["File", "Folder"], auth: true }),
  ],
});
