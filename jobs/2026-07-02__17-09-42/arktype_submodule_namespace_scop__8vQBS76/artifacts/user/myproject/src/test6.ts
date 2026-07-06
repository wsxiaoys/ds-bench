import { scope, type } from "arktype";

// Try referencing submodule from within another submodule with thunk
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
  api: () =>
    scope({
      ...$.import(),
      CreateUserRequest: type({
        user: "db.User",
        token: "32 <= string <= 256",
      }),
      CreateOrgRequest: type({
        org: "db.Org",
        adminUserId: "string.uuid",
      }),
    }).export(),
});

const module_ = $.export();
console.log("Result:", JSON.stringify(Object.keys(module_)));
