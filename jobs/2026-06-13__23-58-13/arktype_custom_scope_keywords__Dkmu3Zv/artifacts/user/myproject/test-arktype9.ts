import { scope } from "arktype";

const myScope = scope({
  myType: "string"
});
const types = myScope.export();
const result = types.myType(123);
console.log(typeof result);
console.log(result.constructor.name);
console.log("arkKind" in result ? result[" arkKind"] : "no");
if (result instanceof Error) {
    console.log("is error");
}
