import { scope, type } from "arktype";

// Test 1: How to use length constraints
const T = scope({
  Name: type("1 <= string <= 50"),
}).export();
console.log("Name validator:", T.Name("hello"));

// Test 2: Submodule keys
console.log("scopetype submodule:", typeof (scope as any));

// Test 3: String keywords
const T2 = scope({
  Id: type("string.uuid"),
}).export();
console.log("UUID validator:", T2.Id("00000000-0000-0000-0000-000000000000"));

// Test 4: Submodule references
import { keywords } from "arktype";
console.log("string.uuid available:", typeof keywords.string.uuid);
