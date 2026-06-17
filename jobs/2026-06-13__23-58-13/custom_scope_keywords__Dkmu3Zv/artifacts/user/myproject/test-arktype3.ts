import { scope } from "arktype";

const myScope = scope({
  creditCard: ["/^[0-9]{13,19}$/", ":", (s: string) => true],
  myType: {
    cc: "creditCard"
  }
});

const types = myScope.export();
console.log(types.myType({ cc: "1234567890123" }));
console.log(types.myType({ cc: "123" }));
