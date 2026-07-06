import { scope, type } from "arktype";

const $ = scope({
  db: type.module({
    User: type({
      id: "string.uuid",
    }),
  }),
  // Reference db.User at the ROOT level - this works
  rootLevelRef: "db.User",
});

console.log("result:", $.export().rootLevelRef({ id: "00000000-0000-0000-0000-000000000000" }));
