import { type } from "arktype";
import productSchema from "./schema";

const sampleProduct = {
  id: "prod-100",
  sku: "SKU-999",
  price: 49.99,
  tags: ["home", "kitchen"],
};

const result = productSchema(sampleProduct);

if (result instanceof type.errors) {
  console.error("Validation failed:", result.summary);
  process.exit(1);
} else {
  console.log(`Validated product: ${result.id}`);
}
