import { scope, type } from "arktype";

const $ = scope({
  db: type.module({
    User: type({
      id: "string.uuid",
      name: "1 <= string <= 50",
      orgId: "string.uuid",
    }),
    Org: type({
      id: "string.uuid",
      name: "1 <= string <= 100",
    }),
  }),
  api: () => {
    console.log("Inner scope thunk running");
    const importedDb = $.import("db");
    console.log("importedDb keys:", Object.keys(importedDb));
    return scope({
      ...importedDb,
      CreateUserRequest: type({
        user: "db.User",
        token: "32 <= string <= 256",
      }),
      CreateOrgRequest: type({
        org: "db.Org",
        adminUserId: "string.uuid",
      }),
    }).export();
  },
});

const module_ = $.export();
console.log("db in module:", "db" in module_);
console.log("api in module:", "api" in module_);
