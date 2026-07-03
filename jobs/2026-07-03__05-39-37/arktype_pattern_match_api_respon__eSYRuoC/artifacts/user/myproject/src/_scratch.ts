import { match, type } from "arktype"

// Approach A: does `type` parse an object string with braces?
try {
  const t = type("{ status: 'success', data: 'object' }" as any)
  console.log("A: object string parsed OK", t)
} catch (e) {
  console.log("A: object string FAILED:", (e as Error).message)
}

// Approach B: .case with object-literal definitions (chained fluent form)
try {
  const m = match
    .case({ status: "'success'", data: "object" } as any, (o: any) => `OK:${JSON.stringify(o.data)}`)
    .case({ status: "'error'", code: "number", reason: "string" } as any, (o: any) => `ERR ${o.code} ${o.reason}`)
    .case({ status: "'pending'" } as any, () => "PENDING")
    .default("assert")
  console.log("B success:", m({ status: "success", data: { id: 7 } }))
  console.log("B error:", m({ status: "error", code: 404, reason: "not found" }))
  console.log("B pending:", m({ status: "pending" }))
  try {
    console.log("B wat:", m({ status: "wat" }))
  } catch (e) {
    console.log("B unmatched threw:", (e as Error).message)
  }
} catch (e) {
  console.log("B FAILED:", (e as Error).message)
}