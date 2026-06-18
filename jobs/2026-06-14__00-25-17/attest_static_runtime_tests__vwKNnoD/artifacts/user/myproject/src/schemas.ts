import { type, scope } from "arktype"

// 1. Morph type: parses a string to a number using the "=>" operator
export const StringToNumber = type("string", "=>", (s) => Number(s))

// 2. Recursive scope: linked list node using scope({...}).export()
//    A type whose definition references itself
export const LinkedList = scope({
	Node: {
		value: "number",
		next: "Node | null"
	}
})

export const { Node } = LinkedList.export()

// 3. Discriminated union: shapes selected by a literal 'kind' tag
export const Shape = type({
	kind: "'circle'",
	radius: "number"
}).or({
	kind: "'rectangle'",
	width: "number",
	height: "number"
})

// 4. Literal-string union: fixed set of role names
export const Role = type("'admin' | 'editor' | 'viewer'")