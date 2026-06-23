import { scope } from "arktype";

const types = scope({
  "db.User": {
    id: "string.uuid",
    name: "string >= 1 <= 50",
    orgId: "string.uuid"
  },
  "db.Org": {
    id: "string.uuid",
    name: "string >= 1 <= 100"
  },
  "api.CreateUserRequest": {
    user: "db.User",
    token: "string >= 32 <= 256"
  },
  "api.CreateOrgRequest": {
    org: "db.Org",
    adminUserId: "string.uuid"
  }
}).export();

export const module = {
  db: {
    User: types["db.User"],
    Org: types["db.Org"]
  },
  api: {
    CreateUserRequest: types["api.CreateUserRequest"],
    CreateOrgRequest: types["api.CreateOrgRequest"]
  }
};
