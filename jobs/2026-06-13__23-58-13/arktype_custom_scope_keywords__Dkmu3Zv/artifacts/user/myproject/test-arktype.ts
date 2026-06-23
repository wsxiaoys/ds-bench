import { scope } from "arktype";

const myScope = scope({
  luhn: ["string", ":", (s: string) => s.length > 5],
  phone: /^\d{3}$/,
  myType: {
    id: "luhn",
    p: "phone"
  }
});

const types = myScope.export();
console.log(types.myType({ id: "123456", p: "123" }));
console.log(types.myType({ id: "123", p: "123" }));
