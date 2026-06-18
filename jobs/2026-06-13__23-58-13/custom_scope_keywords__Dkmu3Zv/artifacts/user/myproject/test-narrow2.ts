import { scope, type } from "arktype";

const myScope = scope({
  creditCard: type("/^\\d{13,19}$/").narrow((s: string) => true)
});
const types = myScope.export();
console.log(types.creditCard("1234567890123"));
