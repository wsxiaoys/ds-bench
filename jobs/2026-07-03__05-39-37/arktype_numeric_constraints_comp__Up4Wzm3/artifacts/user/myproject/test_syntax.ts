import { type } from "arktype"

// Test amount range (strict 0 < n < 10000)
const Amount = type("0 < number < 10000").narrow((n: number) => {
	const str = String(n)
	const dot = str.indexOf(".")
	const decimals = dot === -1 ? 0 : str.length - dot - 1
	return decimals <= 2
})

console.log("=== amount ===")
console.log("description:", Amount.description)
for (const v of [99.99, 10000, 0, 1.234, 50, 9999.99, 0.01, -5]) {
	const result = Amount(v)
	console.log(`  Amount(${v}) =>`, result instanceof type.errors ? "REJECTED: " + result.summary : "OK")
}

// Test validityDays range
const Validity = type("1 <= number.integer <= 365")
console.log("\n=== validityDays ===")
for (const v of [30, 0, 366, 1, 365, 2.5]) {
	const result = Validity(v)
	console.log(`  Validity(${v}) =>`, result instanceof type.errors ? "REJECTED: " + result.summary : "OK")
}

// Test appliesTo
const AppliesTo = type("'cart' | 'shipping' | 'item'")
console.log("\n=== appliesTo ===")
for (const v of ["cart", "shipping", "item", "other"]) {
	const result = AppliesTo(v)
	console.log(`  AppliesTo(${v}) =>`, result instanceof type.errors ? "REJECTED: " + result.summary : "OK")
}