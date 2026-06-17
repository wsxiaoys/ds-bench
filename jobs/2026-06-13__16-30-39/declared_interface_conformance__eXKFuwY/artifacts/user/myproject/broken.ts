import type { Product } from "./types";
import { type } from "arktype";

// Intentionally omits the `tags` property — this should NOT conform to Product
const brokenSchema = type.declare<Product>().type({
  id: "string",
  sku: "string",
  price: "number"
});

export default brokenSchema;