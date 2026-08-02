import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { DocumentPage } from "./src/DocumentPage" with { type: "ref" };
import { LoginPage } from "./src/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/SignupPage" with { type: "ref" };
import { userSignupFields } from "./src/auth" with { type: "ref" };
import { webSocketFn } from "./src/webSocket" with { type: "ref" };

import { getDocuments, getDocument } from "./src/queries" with { type: "ref" };
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
  title: "Real-time Collaborative Document Editor",
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
  },
  spec: [
    route("SignupRoute", "/signup", page(SignupPage)),
    route("LoginRoute", "/login", page(LoginPage)),
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route("DocumentRoute", "/document/:id", page(DocumentPage, { authRequired: true })),

    query(getDocuments, { entities: ["Document", "Permission"] }),
    query(getDocument, { entities: ["Document", "Permission", "User", "Version"] }),

    action(createDocument, { entities: ["Document"] }),
    action(updateDocumentContent, { entities: ["Document", "Permission"] }),
    action(saveVersion, { entities: ["Document", "Version", "Permission"] }),
    action(restoreVersion, { entities: ["Document", "Version", "Permission"] }),
    action(shareDocument, { entities: ["Document", "Permission", "User"] }),
    action(revokePermission, { entities: ["Document", "Permission"] }),
  ],
});
