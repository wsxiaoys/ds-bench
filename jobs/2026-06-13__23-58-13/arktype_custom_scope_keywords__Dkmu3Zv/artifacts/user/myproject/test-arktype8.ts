import { scope } from "arktype";

const myScope = scope({
  myType: "string"
});
const types = myScope.export();
const result = types.myType(123);
console.log(result instanceof Error);
console.log(result.message);
