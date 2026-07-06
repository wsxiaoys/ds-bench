import { scope, type } from "arktype";

// Try: import everything from outer scope via $.import() with no args, in thunk
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
console.log("db in module:", "db" in module_);
console.log("api in module:", "api" in module_);

// Test validation
const userResult = (module_ as any).db.User({
  id: "00000000-0000-0000-0000-000000000000",
  name: "Alice",
  orgId: "00000000-0000-0000-0000-000000000000",
});
console.log("db.User valid:", JSON.stringify(userResult));
