import { scope } from "arktype";

const myScope = scope({
  creditCard: scope.type("/^\\d{13,19}$/").narrow((s: string) => true)
});
