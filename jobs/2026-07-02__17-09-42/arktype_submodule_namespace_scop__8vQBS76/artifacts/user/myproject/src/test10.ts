import { scope, type } from "arktype";

// Approach: define all 4 aliases using dotted keys directly in a single scope call
const module_ = scope({
  "db.User": type({
    id: "string.uuid",
    name: "1 <= string <= 50",
    orgId: "string.uuid",
  }),
  "db.Org": type({
    id: "string.uuid",
    name: "1 <= string <= 100",
  }),
  "api.CreateUserRequest": type({
    user: "db.User",
    token: "32 <= string <= 256",
  }),
  "api.CreateOrgRequest": type({
    org: "db.Org",
    adminUserId: "string.uuid",
  }),
}).export();

console.log("Module keys:", Object.keys(module_));
console.log("Type of db.User:", typeof (module_ as any)["db.User"]);

// Test validation
const userResult = (module_ as any)["db.User"]({
  id: "00000000-0000-0000-0000-000000000000",
  name: "Alice",
  orgId: "00000000-0000-0000-0000-000000000000",
});
console.log("db.User valid:", JSON.stringify(userResult));
