import { type } from "arktype"

const userBody = type({
  username: "alphanumeric >= 3 & <= 20",
  email: "email",
  "age?": "integer >= 13 & <= 120"
})
console.log("user bad username:", JSON.stringify(userBody["~standard"].validate({ username: "ab!", email: "a@b.com" })))
console.log("user short:", JSON.stringify(userBody["~standard"].validate({ username: "ab", email: "a@b.com" })))
console.log("user bad email:", JSON.stringify(userBody["~standard"].validate({ username: "abc", email: "nope" })))
console.log("user age bad:", JSON.stringify(userBody["~standard"].validate({ username: "abc", email: "a@b.com", age: 12 })))
console.log("user ok:", JSON.stringify(userBody["~standard"].validate({ username: "abc", email: "a@b.com", age: 25 })))
console.log("user ok noage:", JSON.stringify(userBody["~standard"].validate({ username: "abc", email: "a@b.com" })))

const searchQuery = type({
  q: "string >= 1 & <= 100",
  page: "string.integer.parse |> integer >= 1",
  limit: "string.integer.parse |> integer >= 1 & <= 50"
})
console.log("search ok:", JSON.stringify(searchQuery["~standard"].validate({ q: "hello", page: "2", limit: "10" })))
console.log("search page types:", (() => { const r = searchQuery["~standard"].validate({ q: "hello", page: "2", limit: "10" }); return r.issues ? "fail" : `${typeof (r as any).value.page} ${(r as any).value.page}` })())
console.log("search page bad:", JSON.stringify(searchQuery["~standard"].validate({ q: "hello", page: "0", limit: "10" })))
console.log("search limit bad:", JSON.stringify(searchQuery["~standard"].validate({ q: "hello", page: "2", limit: "51" })))
console.log("search q empty:", JSON.stringify(searchQuery["~standard"].validate({ q: "", page: "2", limit: "10" })))
