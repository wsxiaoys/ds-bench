import { type } from "arktype";
import type { Product } from "./types";

// Intentionally omits the required `tags` property, so the TypeScript
// compiler should reject this file via type.declare<Product>()'s conformance check.
const brokenProductSchema = type.declare<Product>().type({
	id: "string",
	sku: "string",
	price: "number"
});

export default brokenProductSchema;