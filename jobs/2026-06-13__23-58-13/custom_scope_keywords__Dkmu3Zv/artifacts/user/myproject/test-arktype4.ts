import { scope } from "arktype";

const myScope = scope({
  creditCard: ["/^[0-9]+$/", ":", (s: string) => true],
  cc2: "/^[0-9]{13,19}$/"
});

const types = myScope.export();
console.log(types.cc2("1234567890123"));
