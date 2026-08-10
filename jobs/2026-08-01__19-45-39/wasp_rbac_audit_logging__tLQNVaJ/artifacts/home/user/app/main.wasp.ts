import { app, page, route, query, action } from "@wasp.sh/spec";

import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage, SignupPage } from "./src/pages/auth" with { type: "ref" };

import { onBeforeSignup } from "./src/auth/hooks" with { type: "ref" };
import { userSignupFields } from "./src/auth/signup" with { type: "ref" };

import { getDocuments, getAuditLogs } from "./src/queries" with {
  type: "ref",
};
import {
  createDocument,
  updateDocument,
  deleteDocument,
} from "./src/actions" with { type: "ref" };

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
    onBeforeSignup,
  },
  spec: [
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),

    query(getDocuments, { entities: ["Document"] }),
    query(getAuditLogs, { entities: ["AuditLog"] }),

    action(createDocument, { entities: ["Document", "AuditLog"] }),
    action(updateDocument, { entities: ["Document", "AuditLog"] }),
    action(deleteDocument, { entities: ["Document", "AuditLog"] }),
  ],
});
