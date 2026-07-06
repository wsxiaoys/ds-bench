import { type, scope } from "arktype"

// 1. Literal-string union (a fixed set of role names).
export const Role = type("'admin' | 'user' | 'guest'")

// 2. Morph pipe built with the ArkType `|>` infix operator.
// Infix `|>` chains a string-parsing morph into the input type:
// the right operand is a `string.numeric.parse` morphism that turns
// valid numeric strings into a number.
export const ParsedNumber = type("string", "|>", "string.numeric.parse")

// 3. A recursive type exported from a scope. `TreeNode` references itself via
// the `children` branch, satisfying the "recursive `scope({...}).export()`"
// requirement.
export const types = scope({
	TreeNode: {
		value: "string",
		children: "TreeNode[]"
	}
}).export()

export const TreeNode = types.TreeNode

// 4. A discriminated union selected by a literal `kind` tag. The two branches
// share the `kind` property as a discriminator which ArkType narrows from the
// literal variant.
export const Event = type({
	kind: "'login'"
}).or({
	kind: "'logout'",
	"timestamp?": "number"
})
