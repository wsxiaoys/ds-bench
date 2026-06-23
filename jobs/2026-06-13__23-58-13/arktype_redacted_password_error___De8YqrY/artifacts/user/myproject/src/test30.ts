import { type } from "arktype"

const passwordType = type("string").narrow((s, ctx) => {
    if (s.length < 12) { ctx.reject({ expected: "at least length 12", actual: "<redacted>" }); return false; }
    return true;
})

const res = passwordType("abc")
console.log(JSON.stringify(res.byPath))
