import { type as arkType } from "arktype";
import { Product } from "./types";

const type = {
  declare: <T>() => arkType.declare<T>().type
};

const brokenSchema = type.declare<Product>()({
  id: "string",
  sku: "string",
  price: "number"
});

export default brokenSchema;
