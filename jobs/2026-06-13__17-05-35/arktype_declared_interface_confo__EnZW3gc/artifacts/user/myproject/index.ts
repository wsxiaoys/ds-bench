import { type } from "arktype";
import productSchema from "./schema.ts";

const sample: unknown = {
  id: "prod-001",
  sku: "SKU-12345",
  price: 29.99,
  tags: ["electronics", "gadget"],
};

const result = productSchema(sample);
if (result instanceof type.errors) {
  console.error("Validation failed:", result.summary);
  process.exit(1);
}

console.log(`Validated product: ${result.id}`);
