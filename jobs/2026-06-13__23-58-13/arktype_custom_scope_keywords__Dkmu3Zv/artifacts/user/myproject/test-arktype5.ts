import { scope } from "arktype";

const myScope = scope({
  slug: "/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/ >= 3 <= 64"
});

const types = myScope.export();
console.log(types.slug("a-b"));
console.log(types.slug("ab"));
