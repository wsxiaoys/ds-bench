import { scope, Module } from "arktype";

// ---------------------------------------------------------------------------
// All four submodule aliases are declared inside a SINGLE scope({...}) call.
//
// Dot-namespaced string keys ("db.User", "api.CreateUserRequest", …) are
// ArkType's submodule-key feature: the scope registers them as named aliases
// and uses the dotted prefix when resolving cross-references at parse time.
//
// The api.* definitions reference db.* by string alias ("db.User", "db.Org"),
// satisfying the requirement that no shape is duplicated / inlined.
// ---------------------------------------------------------------------------
const myScope = scope({
  // ── db namespace ──────────────────────────────────────────────────────────
  "db.User": {
    id: "string.uuid",
    name: "1<=string<=50",
    orgId: "string.uuid",
  },
  "db.Org": {
    id: "string.uuid",
    name: "1<=string<=100",
  },

  // ── api namespace ─────────────────────────────────────────────────────────
  // `user` and `org` reference the db.* aliases by string – NOT by inlining
  // the object shapes again.
  "api.CreateUserRequest": {
    user: "db.User",
    token: "32<=string<=256",
  },
  "api.CreateOrgRequest": {
    org: "db.Org",
    adminUserId: "string.uuid",
  },
});

// Export the flat module that contains all four aliases.
const raw = myScope.export();

// ---------------------------------------------------------------------------
// Assemble the public-facing nested module so that consumers can reach:
//
//   schemaModule.db.User                 → Type
//   schemaModule.db.Org                  → Type
//   schemaModule.api.CreateUserRequest   → Type
//   schemaModule.api.CreateOrgRequest    → Type
//
// We construct thin Module wrappers around the already-resolved Type objects
// that came out of the single scope export above.
// ---------------------------------------------------------------------------
const dbModule = new Module({
  User: (raw as Record<string, unknown>)["db.User"],
  Org: (raw as Record<string, unknown>)["db.Org"],
});

const apiModule = new Module({
  CreateUserRequest: (raw as Record<string, unknown>)["api.CreateUserRequest"],
  CreateOrgRequest: (raw as Record<string, unknown>)["api.CreateOrgRequest"],
});

export const schemaModule = new Module({
  db: dbModule,
  api: apiModule,
});

export type SchemaModule = typeof schemaModule;
