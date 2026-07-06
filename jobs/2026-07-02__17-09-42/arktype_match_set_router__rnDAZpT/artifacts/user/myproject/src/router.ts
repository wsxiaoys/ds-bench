import { match } from "arktype";

/**
 * Routes heterogeneous events to handler output strings based on
 * set-theoretic shape using ArkType's `match` pattern matcher.
 *
 * Cases (in order):
 *   1. bare `string`                                          -> "text:<length>"
 *   2. bare `number`                                          -> "num:<value>"
 *   3. `string[]`                                             -> "list:<length>"
 *   4. click { kind: "click", target: { type: "button" }, id: string }
 *                                                              -> "btn:<id>"
 *   5. click { kind: "click", target: { type: "link", href: string.url } }
 *                                                              -> "link:<href>"
 *   6. submit { kind: "submit", payload: { formId: string, valid: boolean } }
 *                                                              -> "submit:<formId>:<valid>"
 *
 * Anything else triggers the `default: "assert"` rejection, which causes
 * ArkType to throw a `TraversalError`.
 */
export const route = match({
	string: (s) => `text:${s.length}`,
	number: (n) => `num:${n}`,
	"string[]": (arr) => `list:${arr.length}`,
})
	.case(
		{
			kind: "'click'",
			target: { type: "'button'" },
			id: "string",
		},
		(e) => `btn:${(e as { id: string }).id}`,
	)
	.case(
		{
			kind: "'click'",
			target: { type: "'link'", href: "string.url" },
		},
		(e) =>
			`link:${(e as { target: { href: string } }).target.href}`,
	)
	.case(
		{
			kind: "'submit'",
			payload: { formId: "string", valid: "boolean" },
		},
		(e) => {
			const payload = (e as {
				payload: { formId: string; valid: boolean };
			}).payload;
			return `submit:${payload.formId}:${payload.valid}`;
		},
	)
	.default("assert");