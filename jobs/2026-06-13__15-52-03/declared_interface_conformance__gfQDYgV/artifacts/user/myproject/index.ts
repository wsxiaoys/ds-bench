import { type } from "arktype";
import productSchema from "./schema.ts";

const sample = {
  id: "prod-001",
  sku: "SKU-XYZ",
  price: 29.99,
  tags: ["electronics", "sale"],
};

const result = productSchema(sample);

if (result instanceof type.errors) {
  console.error("Validation failed:", result.summary);
  process.exit(1);
}

console.log(`Validated product: ${result.id}`);
