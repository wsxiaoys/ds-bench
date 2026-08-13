import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage, SignupPage } from "./src/pages/auth" with { type: "ref" };
import { DocumentPage } from "./src/pages/DocumentPage" with { type: "ref" };

import { getDocuments, getDocument } from "./src/queries" with { type: "ref" };
import {
  createDocument,
  saveVersion,
  shareDocument,
  revokePermission,
  restoreVersion,
} from "./src/actions" with { type: "ref" };
import { webSocketFn } from "./src/webSocket" with { type: "ref" };
import { userSignupFields } from "./src/auth/signup" with { type: "ref" };

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
    onAuthSucceededRedirectTo: "/",
  },
  webSocket: {
    fn: webSocketFn,
    autoConnect: true,
  },
  spec: [
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),
    route("DocumentRoute", "/document/:id", page(DocumentPage, { authRequired: true })),

    query(getDocuments, { entities: ["Document", "Permission"] }),
    query(getDocument, { entities: ["Document", "Permission", "Version", "User"] }),

    action(createDocument, { entities: ["Document"] }),
    action(saveVersion, { entities: ["Document", "Version", "User"] }),
    action(shareDocument, { entities: ["Document", "Permission", "User"] }),
    action(revokePermission, { entities: ["Permission"] }),
    action(restoreVersion, { entities: ["Document", "Version"] }),
  ],
});
