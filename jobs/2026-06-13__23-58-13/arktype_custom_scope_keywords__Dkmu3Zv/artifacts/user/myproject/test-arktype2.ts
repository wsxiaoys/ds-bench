import { scope } from "arktype";

const myScope = scope({
  slug: ["/^[a-z0-9-]+$/", ":", (s: string) => s.length >= 3 && s.length <= 64 && !s.startsWith('-') && !s.endsWith('-')],
  myType: {
    id: "slug"
  }
});

const types = myScope.export();
console.log(types.myType({ id: "a-b" }));
console.log(types.myType({ id: "ab" }));
console.log(types.myType({ id: "-abc" }));
