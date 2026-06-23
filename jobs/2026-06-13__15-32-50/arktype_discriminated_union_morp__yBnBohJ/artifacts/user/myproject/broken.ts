import { type } from "arktype"

// One branch that morphs the value
const branch1 = type({
  value: "string"
}).pipe((v) => ({ value: parseInt(v.value, 10) }))

// Another branch that morphs the value differently (or doesn't morph it, but overlaps)
const branch2 = type({
  value: "string"
}).pipe((v) => ({ value: v.value }))

// This ambiguous union constructs and parses, triggering ArkType's ParseError
const ambiguousUnion = type(branch1, "|", branch2)
