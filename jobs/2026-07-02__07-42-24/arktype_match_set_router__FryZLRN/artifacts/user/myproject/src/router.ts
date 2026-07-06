import { match } from "arktype"

export const route = match({
	string: (v) => `text:${v.length}`,
	number: (v) => `num:${v}`,
	"string[]": (v) => `list:${v.length}`,
})
	.case(
		{
			kind: "'click'",
			target: {
				type: "'button'",
				id: "string",
			},
		},
		(v) => `btn:${v.target.id}`,
	)
	.case(
		{
			kind: "'click'",
			target: {
				type: "'link'",
				href: "string.url",
			},
		},
		(v) => `link:${v.target.href}`,
	)
	.case(
		{
			kind: "'submit'",
			payload: {
				formId: "string",
				valid: "boolean",
			},
		},
		(v) => `submit:${v.payload.formId}:${v.payload.valid}`,
	)
	.default("assert")
