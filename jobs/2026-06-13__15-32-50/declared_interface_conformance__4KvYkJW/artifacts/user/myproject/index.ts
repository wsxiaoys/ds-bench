import { type } from "arktype";
import productSchema from "./schema.js";

const sampleProduct = {
  id: "prod-100",
  sku: "SKU-999-XYZ",
  price: 49.99,
  tags: ["electronics", "gadget", "sale"]
};

const result = productSchema(sampleProduct);

if (result instanceof type.errors) {
  console.error("Validation failed:", result.summary);
  process.exit(1);
} else {
  console.log(`Validated product: ${result.id}`);
  process.exit(0);
}
