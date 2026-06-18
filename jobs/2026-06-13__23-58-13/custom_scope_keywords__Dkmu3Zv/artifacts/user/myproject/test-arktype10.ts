import { scope } from "arktype";

const myScope = scope({
  myType: "string"
});
const types = myScope.export();
try {
  types.myType.assert(123);
} catch (e: any) {
  console.log("Caught:", e.message);
}
