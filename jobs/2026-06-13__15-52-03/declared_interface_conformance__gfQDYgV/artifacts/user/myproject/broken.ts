import { type } from "arktype";
import type { Product } from "./types.ts";

// Intentionally omits the `tags` property — TypeScript must reject this.
const brokenProductSchema = type.declare<Product>().type({
  id: "string",
  sku: "string",
  price: "number",
});

export default brokenProductSchema;
