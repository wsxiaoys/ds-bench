import { type } from "arktype";
import type { Product } from "./types.ts";

// Intentionally omits `tags` to break conformance with Product
const brokenSchema = type.declare<Product>().type({
  id: "string",
  sku: "string",
  price: "number",
});

export default brokenSchema;
