import { scope, type } from "arktype"

// Approach: submodules via type.module, cross-reference db.User from api
const $ = scope({
    db: type.module({
        User: { id: "uuid", name: "string>=1<=50", orgId: "uuid" },
        Org: { id: "uuid", name: "string>=1<=100" }
    }),
    api: type.module({
        CreateUserRequest: { user: "db.User", token: "string>=32<=256" },
        CreateOrgRequest: { org: "db.Org", adminUserId: "uuid" }
    })
})

const m = $.export()
console.log("db.User:", m.db.User)
console.log("api.CreateUserRequest:", m.api.CreateUserRequest)
const result = m.api.CreateUserRequest({
    user: { id: "550e8400-e29b-41d4-a716-446655440000", name: "Alice", orgId: "660e8400-e29b-41d4-a716-446655440000" },
    token: "a".repeat(64)
})
console.log("result:", result)