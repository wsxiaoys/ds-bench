import { action, app, page, query, route } from "@wasp.sh/spec";

import { MainPage } from "./src/MainPage" with { type: "ref" };
import { DocumentPage } from "./src/DocumentPage" with { type: "ref" };
import { LoginPage } from "./src/pages/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/pages/SignupPage" with { type: "ref" };

import { userSignupFields } from "./src/auth/userSignupFields" with {
  type: "ref",
};

import {
  getMyDocuments,
  getDocument,
} from "./src/operations/queries" with { type: "ref" };

import {
  createDocument,
  saveVersion,
  restoreVersion,
  shareDocument,
  revokePermission,
} from "./src/operations/actions" with { type: "ref" };

import { webSocketFn } from "./src/webSocket" with { type: "ref" };

export default app({
  name: "app",
  title: "app",
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
    route("SignupRoute", "/signup", page(SignupPage)),
    route("LoginRoute", "/login", page(LoginPage)),
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route(
      "DocumentRoute",
      "/document/:id",
      page(DocumentPage, { authRequired: true }),
    ),

    query(getMyDocuments, { entities: ["Document", "Permission"] }),
    query(getDocument, {
      entities: ["Document", "Permission", "Version", "User"],
    }),

    action(createDocument, { entities: ["Document"] }),
    action(saveVersion, { entities: ["Document", "Version", "Permission"] }),
    action(restoreVersion, {
      entities: ["Document", "Version", "Permission"],
    }),
    action(shareDocument, { entities: ["Document", "Permission", "User"] }),
    action(revokePermission, { entities: ["Permission", "Document"] }),
  ],
});
