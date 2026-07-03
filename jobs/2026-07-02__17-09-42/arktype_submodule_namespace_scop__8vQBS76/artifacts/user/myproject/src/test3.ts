import { scope, type, Module } from "arktype";

// Try using Module() to create submodules within the scope
// This works only at runtime, but the question is whether ArkType accepts nested Modules in scope

// Approach 1: Use Scope.module to create the modules
const dbModule = scope({
  User: type({
    id: "string.uuid",
    name: "1 <= string <= 50",
    orgId: "string.uuid",
  }),
  Org: type({
    id: "string.uuid",
    name: "1 <= string <= 100",
  }),
});

const apiModule = scope({
  CreateUserRequest: type({
    user: "User",
    token: "32 <= string <= 256",
  }),
  CreateOrgRequest: type({
    org: "Org",
    adminUserId: "string.uuid",
  }),
});

console.log("db has User:", "User" in dbModule);
console.log("api has CreateUserRequest:", "CreateUserRequest" in apiModule);
