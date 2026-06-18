import type { Product } from "./types";
import { type } from "arktype";

const productSchema = type.declare<Product>().type({
  id: "string",
  sku: "string",
  price: "number",
  tags: "string[]"
});

export default productSchema;