import { scope, type } from "arktype";

// Test submodule syntax
// Based on ArkType docs, submodule keys use dot notation:
// { "db.User": ..., "db.Org": ... }
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
}).export();

console.log("module has db:", "db" in module_);
console.log("module.db has User:", "User" in (module_ as any).db);
console.log("module.db.User type:", typeof (module_ as any).db.User);

// Test the User validator
const result = (module_ as any).db.User({
  id: "00000000-0000-0000-0000-000000000000",
  name: "Alice",
  orgId: "00000000-0000-0000-0000-000000000000",
});
console.log("User validation:", JSON.stringify(result, null, 2));
