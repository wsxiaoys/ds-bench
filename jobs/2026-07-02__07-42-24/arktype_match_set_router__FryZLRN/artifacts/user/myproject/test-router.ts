import { route } from "./src/router.js"
import { TraversalError } from "arktype"

const cases = [
	{ input: "hello", expected: "text:5" },
	{ input: 42, expected: "num:42" },
	{ input: ["a", "b", "c"], expected: "list:3" },
	{
		input: { kind: "click", target: { type: "button", id: "btn-1" } },
		expected: "btn:btn-1",
	},
	{
		input: {
			kind: "click",
			target: { type: "link", href: "https://example.com" },
		},
		expected: "link:https://example.com",
	},
	{
		input: { kind: "submit", payload: { formId: "login", valid: true } },
		expected: "submit:login:true",
	},
	{
		input: { kind: "submit", payload: { formId: "signup", valid: false } },
		expected: "submit:signup:false",
	},
]

console.log("Running valid cases...")
for (const { input, expected } of cases) {
	try {
		const result = route(input)
		if (result === expected) {
			console.log(`PASS: ${JSON.stringify(input)} -> ${result}`)
		} else {
			console.error(
				`FAIL: ${JSON.stringify(input)} -> Expected: ${expected}, Got: ${result}`,
			)
			process.exit(1)
		}
	} catch (err) {
		console.error(`FAIL: ${JSON.stringify(input)} threw an error:`, err)
		process.exit(1)
	}
}

console.log("\nRunning invalid cases...")
const invalidCases = [
	true,
	null,
	{ kind: "click", target: { type: "button" } }, // missing id
	{ kind: "click", target: { type: "link", href: "not-a-url" } }, // invalid URL
	{ kind: "submit", payload: { formId: "login" } }, // missing valid
	{ kind: "submit", payload: { valid: true } }, // missing formId
	{ kind: "click", target: { type: "other", id: "btn-1" } }, // invalid target type
]

for (const input of invalidCases) {
	try {
		route(input)
		console.error(`FAIL: Expected error for ${JSON.stringify(input)} but none was thrown.`)
		process.exit(1)
	} catch (err) {
		if (err instanceof TraversalError) {
			console.log(`PASS: ${JSON.stringify(input)} correctly threw TraversalError: ${err.message}`)
		} else {
			console.error(`FAIL: ${JSON.stringify(input)} threw wrong error:`, err)
			process.exit(1)
		}
	}
}

console.log("\nAll tests passed successfully!")
