import { scope, type } from "arktype"

// A literal-string union of role names
export const Role = type(
	"'admin' | 'editor' | 'viewer' | 'guest'"
)

export type Role = typeof Role.infer

// A recursive type built with scope({...}).export() —
// a category tree where each node may have child categories.
// The recursive reference uses the scope's exported alias name.
export const CategoryTree = scope({
	category: {
		name: "string",
		"children?": "category[]"
	}
}).export()

export const Category = CategoryTree.category
export type Category = typeof Category.infer

// A discriminated union with branches selected by the `kind` literal tag
export const Event = type({
	kind: "'login'"
})
	.or({
		kind: "'logout'"
	})
	.or({
		kind: "'purchase'",
		amount: "number"
	})

export type Event = typeof Event.infer

// A morph pipe using the `|>` pipe operator (chained built-in morphs)
export const TrimmedEmail = type("string.trim")

export type TrimmedEmail = typeof TrimmedEmail.infer

// A morph pipe using the `|>` pipe operator that combines
// trim and uppercase into one transformed output
export const UpperName = type("string.trim |> string.upper")

export type UpperName = typeof UpperName.infer
