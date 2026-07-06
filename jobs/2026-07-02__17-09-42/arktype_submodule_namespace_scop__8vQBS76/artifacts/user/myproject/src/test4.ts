import { scope, type, Module } from "arktype";

// Submodule approach: define db and api as separate module exports within outer scope
const module_ = scope({
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
  api: type.module({
    CreateUserRequest: type({
      user: "db.User",
      token: "32 <= string <= 256",
    }),
    CreateOrgRequest: type({
      org: "db.Org",
      adminUserId: "string.uuid",
    }),
  }),
}).export();

// Verify submodule keys
console.log("db in module:", "db" in module_);
console.log("api in module:", "api" in module_);
console.log("db.User exists:", (module_ as any).db && "User" in (module_ as any).db);
console.log("api.CreateUserRequest exists:", (module_ as any).api && "CreateUserRequest" in (module_ as any).api);

// Test validation
const userResult = (module_ as any).db.User({
  id: "00000000-0000-0000-0000-000000000000",
  name: "Alice",
  orgId: "00000000-0000-0000-0000-000000000000",
});
console.log("db.User valid:", JSON.stringify(userResult));

const createUserResult = (module_ as any).api.CreateUserRequest({
  user: {
    id: "00000000-0000-0000-0000-000000000000",
    name: "Alice",
    orgId: "00000000-0000-0000-0000-000000000000",
  },
  token: "a".repeat(50),
});
console.log("api.CreateUserRequest valid:", JSON.stringify(createUserResult));

// Test invalid length
const invalidUser = (module_ as any).db.User({
  id: "00000000-0000-0000-0000-000000000000",
  name: "",
  orgId: "00000000-0000-0000-0000-000000000000",
});
console.log("Empty name invalid (errors):", invalidUser instanceof Error || (invalidUser && invalidUser.summary));

// Test invalid UUID
const invalidUuid = (module_ as any).db.User({
  id: "not-a-uuid",
  name: "Alice",
  orgId: "00000000-0000-0000-0000-000000000000",
});
console.log("Bad UUID invalid (errors):", invalidUuid instanceof Error || (invalidUuid && invalidUuid.summary));

// Test invalid token length
const invalidToken = (module_ as any).api.CreateUserRequest({
  user: {
    id: "00000000-0000-0000-0000-000000000000",
    name: "Alice",
    orgId: "00000000-0000-0000-0000-000000000000",
  },
  token: "short",
});
console.log("Short token invalid (errors):", invalidToken instanceof Error || (invalidToken && invalidToken.summary));
