import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { DocumentPage } from "./src/DocumentPage" with { type: "ref" };
import { LoginPage } from "./src/pages/auth/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/pages/auth/SignupPage" with { type: "ref" };
import { userSignupFields } from "./src/auth/signup" with { type: "ref" };
import { webSocketFn } from "./src/websocket" with { type: "ref" };

import {
  getDocuments,
  getDocument,
} from "./src/queries" with { type: "ref" };

import {
  createDocument,
  updateDocumentContent,
  saveVersion,
  restoreVersion,
  shareDocument,
  revokePermission,
} from "./src/actions" with { type: "ref" };

export default app({
  name: "app",
  title: "Real-time Collaborative Editor",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {
        userSignupFields,
      },
    },
    onAuthFailedRedirectTo: "/login",
  },
  webSocket: {
    fn: webSocketFn,
    autoConnect: true,
  },
  spec: [
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route("DocumentRoute", "/document/:id", page(DocumentPage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),

    query(getDocuments, { entities: ["Document", "Permission"] }),
    query(getDocument, { entities: ["Document", "Version", "Permission", "User"] }),

    action(createDocument, { entities: ["Document"] }),
    action(updateDocumentContent, { entities: ["Document"] }),
    action(saveVersion, { entities: ["Document", "Version"] }),
    action(restoreVersion, { entities: ["Document", "Version"] }),
    action(shareDocument, { entities: ["Document", "Permission", "User"] }),
    action(revokePermission, { entities: ["Document", "Permission"] }),
  ],
});
