import { type } from "arktype";
import type { Product } from "./types.ts";

const productSchema = type.declare<Product>().type({
  id: "string",
  sku: "string",
  price: "number",
  tags: "string[]",
});

export default productSchema;
