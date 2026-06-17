import { scope } from "arktype";

export const types = (() => {
  const s = scope({
    "db.User": {
      id: "string.uuid",
      name: "1<=string<=50",
      orgId: "string.uuid"
    },
    "db.Org": {
      id: "string.uuid",
      name: "1<=string<=100"
    },
    "api.CreateUserRequest": {
      user: "db.User",
      token: "32<=string<=256"
    },
    "api.CreateOrgRequest": {
      org: "db.Org",
      adminUserId: "string.uuid"
    }
  }).export();

  return Object.assign(s, {
    db: {
      User: s["db.User"],
      Org: s["db.Org"]
    },
    api: {
      CreateUserRequest: s["api.CreateUserRequest"],
      CreateOrgRequest: s["api.CreateOrgRequest"]
    }
  });
})();
