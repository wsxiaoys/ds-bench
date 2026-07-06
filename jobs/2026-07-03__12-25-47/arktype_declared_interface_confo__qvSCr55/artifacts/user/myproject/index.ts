import productSchema from "./schema";
import type { Product } from "./types";

const sample: Product = {
  id: "prod-001",
  sku: "SKU-ABC-123",
  price: 19.99,
  tags: ["new", "featured"],
};

const result = productSchema(sample);

if (result instanceof Error) {
  console.error("Validation failed:", result.message);
  process.exit(1);
}

console.log(`Validated product: ${result.id}`);
