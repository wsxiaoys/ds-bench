import { scope, Module } from "arktype"

const flat = scope({
  "db.User": {
    id: "string.uuid",
    name: "string>=1<=50",
    orgId: "string.uuid",
  },
  "db.Org": {
    id: "string.uuid",
    name: "string>=1<=100",
  },
  "api.CreateUserRequest": {
    user: "db.User",
    token: "string>=32<=256",
  },
  "api.CreateOrgRequest": {
    org: "db.Org",
    adminUserId: "string.uuid",
  },
}).export()

export const schema = new Module({
  db: new Module({
    User: flat["db.User"],
    Org: flat["db.Org"],
  }),
  api: new Module({
    CreateUserRequest: flat["api.CreateUserRequest"],
    CreateOrgRequest: flat["api.CreateOrgRequest"],
  }),
})