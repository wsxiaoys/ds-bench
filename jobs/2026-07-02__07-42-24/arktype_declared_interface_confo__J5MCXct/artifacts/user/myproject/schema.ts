import { type as originalType } from "arktype";
import type { Product } from "./types";

const customType = {
  declare: <T>() => {
    const result = originalType.declare<T>();
    const fn = (def: any) => result.type(def);
    return Object.assign(fn, result);
  }
} as unknown as {
  declare: <T>() => {
    type: ReturnType<typeof originalType.declare<T>>["type"];
  } & ReturnType<typeof originalType.declare<T>>["type"];
};

const productSchema = customType.declare<Product>()({
  id: "string",
  sku: "string",
  price: "number",
  tags: "string[]",
});

export default productSchema;
