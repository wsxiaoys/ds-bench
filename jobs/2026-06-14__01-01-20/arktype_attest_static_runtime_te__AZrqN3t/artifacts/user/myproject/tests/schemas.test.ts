import { attest } from "@arktype/attest"
import { type } from "arktype"
import { describe, it } from "vitest"
import { CommaSeparatedList, JSONValue, Role, Shape } from "../src/schemas.js"

describe("ArkType schemas", () => {
  // ---- Role: literal-string union ----
  it("Role - literal-string union type equality", () => {
    // Pure compile-time type-equality check
    attest<"admin" | "editor" | "viewer", typeof Role.infer>(undefined as never)
  })

  it("Role - type toString snap", () => {
    attest(Role.infer).type.toString.snap("'admin' | 'editor' | 'viewer'")
  })

  it("Role - runtime validation succeeds", () => {
    attest(Role("admin")).snap("admin")
  })

  // ---- Shape: discriminated union ----
  it("Shape - discriminated union type toString snap", () => {
    attest(Shape.infer).type.toString.snap(
      "({ kind: 'circle'; radius: number } | { kind: 'rectangle'; width: number; height: number }) | { kind: 'triangle'; base: number; height: number }",
    )
  })

  it("Shape - completions check on valid shape", () => {
    const circle = Shape.assert({ kind: "circle", radius: 5 })
    // completions: autocomplete suggestions for the object keys
    attest(circle).completions({
      kind: ["circle"],
      radius: [],
    })
  })

  // ---- CommaSeparatedList: morph ----
  it("CommaSeparatedList - morph transforms input", () => {
    const result = CommaSeparatedList("a, b, c")
    attest(result).equals(["a", "b", "c"])
  })

  it("CommaSeparatedList - type toString equals", () => {
    attest(CommaSeparatedList.infer).type.toString.equals("string")
  })

  it("CommaSeparatedList - morph output type", () => {
    // The output type of the morph is string[]
    attest<string[], typeof CommaSeparatedList.inferOut>(undefined as never)
  })

  // ---- JSONValue: recursive scope ----
  it("JSONValue - runtime throws on invalid input", () => {
    // A function that is not a valid JSON value should throw
    attest(() => JSONValue.assert(() => {})).throws("must be")
  })

  it("JSONValue - throwsAndHasTypeError on deliberately wrong type", () => {
    // Passing a symbol to JSONValue is a compile-time error and runtime error
    // @ts-expect-error
    attest(() => JSONValue.assert(Symbol("bad"))).throwsAndHasTypeError(
      /must be/,
    )
  })

  it("JSONValue - completions on a valid JSON object", () => {
    const obj = JSONValue.assert({ name: "test", count: 42 })
    // @ts-expect-error (completions may not be defined on the narrowed type)
    attest(obj).completions({})
  })

  it("JSONValue - type toString snap for recursive type", () => {
    attest(JSONValue.JsonPrimitive.infer).type.toString.snap(
      "string | number | boolean | null",
    )
  })
})
