import { type } from "arktype";
import productSchema from "./schema";

const payload = {
  id: "prod-88",
  sku: "SKU-999",
  price: 19.99,
  tags: ["electronics", "gadget"]
};

const result = productSchema(payload);

if (result instanceof type.errors) {
  console.error("Validation failed:", result.summary);
  process.exit(1);
} else {
  console.log(`Validated product: ${result.id}`);
}
