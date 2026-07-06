import { type } from "arktype";

try {
  const querySchema = type({
    q: "1 <= string <= 100",
    page: type("string.integer.parse").to("number >= 1"),
    limit: type("string.integer.parse").to("1 <= number <= 50")
  });
  
  const res = querySchema({ q: "hello" });
  if (res instanceof type.errors) {
    console.log("Validation failed on missing properties:", res.summary);
  } else {
    console.log("Validation succeeded:", res);
  }
} catch (e) {
  console.error("Error:", e);
}
