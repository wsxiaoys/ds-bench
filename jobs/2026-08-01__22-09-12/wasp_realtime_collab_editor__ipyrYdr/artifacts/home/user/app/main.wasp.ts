import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { DocumentPage } from "./src/DocumentPage" with { type: "ref" };
import { LoginPage } from "./src/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/SignupPage" with { type: "ref" };
import { userSignupFields } from "./src/auth/signup" with { type: "ref" };
import { webSocketFn } from "./src/webSocket" with { type: "ref" };
import { getDocuments } from "./src/queries" with { type: "ref" };
import { getDocument } from "./src/queries" with { type: "ref" };
import { getVersions } from "./src/queries" with { type: "ref" };
import { getPermissions } from "./src/queries" with { type: "ref" };
import { createDocument } from "./src/actions" with { type: "ref" };
import { updateDocumentContent } from "./src/actions" with { type: "ref" };
import { saveVersion } from "./src/actions" with { type: "ref" };
import { shareDocument } from "./src/actions" with { type: "ref" };
import { revokePermission } from "./src/actions" with { type: "ref" };
import { restoreVersion } from "./src/actions" with { type: "ref" };

export default app({
  name: "collaborativeEditor",
  title: "Collaborative Document Editor",
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
    route("SignupRoute", "/signup", page(SignupPage)),
    route("LoginRoute", "/login", page(LoginPage)),
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route("DocumentRoute", "/document/:id", page(DocumentPage, { authRequired: true })),
    query(getDocuments, { entities: ["Document", "Permission"] }),
    query(getDocument, { entities: ["Document", "Permission", "Version"] }),
    query(getVersions, { entities: ["Version"] }),
    query(getPermissions, { entities: ["Permission", "User"] }),
    action(createDocument, { entities: ["Document"] }),
    action(updateDocumentContent, { entities: ["Document"] }),
    action(saveVersion, { entities: ["Document", "Version"] }),
    action(shareDocument, { entities: ["Document", "Permission", "User"] }),
    action(revokePermission, { entities: ["Permission"] }),
    action(restoreVersion, { entities: ["Document", "Version"] }),
  ],
});
