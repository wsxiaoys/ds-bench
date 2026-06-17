import { type as arkType } from "arktype";
import { Product } from "./types";

const type = {
  declare: <T>() => arkType.declare<T>().type
};

const productSchema = type.declare<Product>()({
  id: "string",
  sku: "string",
  price: "number",
  tags: "string[]"
});

export default productSchema;
