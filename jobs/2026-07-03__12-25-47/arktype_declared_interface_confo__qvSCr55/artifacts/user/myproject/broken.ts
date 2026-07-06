import { type } from "arktype";
import type { Product } from "./types";

// Intentionally broken: missing the required `tags` property.
const brokenProductSchema = type.declare<Product>()({
  id: "string",
  sku: "string",
  price: "number",
});

export default brokenProductSchema;
