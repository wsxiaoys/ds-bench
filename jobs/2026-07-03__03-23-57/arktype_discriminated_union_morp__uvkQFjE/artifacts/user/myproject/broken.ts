import { type } from "arktype"

// This ambiguous union constructs two branches without a discriminator,
// where one branch applies a morph and the other doesn't (or both apply different morphs),
// causing an overlapping indeterminate input that ArkType refuses to parse.
const branchA = type({
  value: type("string").pipe((s) => Number(s))
})

const branchB = type({
  value: "string"
})

// This will throw ParseError: An unordered union of a type including a morph and a type with overlapping input is indeterminate
const AmbiguousUnion = branchA.or(branchB)

console.log("This should not be reached:", AmbiguousUnion)
