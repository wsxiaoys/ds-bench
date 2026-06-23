import productSchema from "./schema.js";

const sample = {
  id: "prod-001",
  sku: "SKU-12345",
  price: 29.99,
  tags: ["electronics", "gadget"]
};

const result = productSchema.assert(sample);
console.log(`Validated product: ${result.id}`);