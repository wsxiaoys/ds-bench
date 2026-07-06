import { scope, type } from "arktype";

// Approach: use thunk with $.import() to enable submodule-to-submodule reference
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
      ...$.import("db"),
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

// Test invalid API name length (50 char)
const tooLongName = (module_ as any).db.User({
  id: "00000000-0000-0000-0000-000000000000",
  name: "a".repeat(60),
  orgId: "00000000-0000-0000-0000-000000000000",
});
console.log("Too long name invalid (errors):", tooLongName instanceof Error || (tooLongName && tooLongName.summary));

// Test missing field
const missingField = (module_ as any).db.User({
  id: "00000000-0000-0000-0000-000000000000",
  name: "Alice",
});
console.log("Missing field invalid (errors):", missingField instanceof Error || (missingField && missingField.summary));
