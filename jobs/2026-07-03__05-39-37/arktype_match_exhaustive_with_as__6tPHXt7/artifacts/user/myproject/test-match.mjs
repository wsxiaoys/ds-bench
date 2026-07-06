const { match, type } = await import("arktype")

// Test 1: object literal string with braces
try {
  const t = type("{ kind: 'length', meters: number }")
  console.log("Test1 (braces string):", t({ kind: "length", meters: 1 }))
} catch (e) {
  console.log("Test1 FAIL:", e.message)
}

// Test 2: object literal as actual JS object
try {
  const t = type({ kind: "length", meters: "number" })
  console.log("Test2 (object def):", t({ kind: "length", meters: 1 }))
} catch (e) {
  console.log("Test2 FAIL:", e.message)
}

// Test 3: match.at on kind
try {
  const c = match.at("kind", {
    length: (d) => `len ${d.meters}`,
    mass: (d) => `mass ${d.kilograms}`,
    temperature: (d) => `temp ${d.celsius}`,
    default: "assert"
  })
  console.log("Test3 (match.at):", c({ kind: "length", meters: 1 }))
} catch (e) {
  console.log("Test3 FAIL:", e.message)
}

// Test 4: match with object-def keys isn't possible (keys are strings)
// Try match.case builder
try {
  const c = match
    .case({ kind: "length", meters: "number" }, (d) => `len ${d.meters}`)
    .case({ kind: "mass", kilograms: "number" }, (d) => `mass ${d.kilograms}`)
    .default("assert")
  console.log("Test4 (match.case):", c({ kind: "length", meters: 1 }))
} catch (e) {
  console.log("Test4 FAIL:", e.message)
}