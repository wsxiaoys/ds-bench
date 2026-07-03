import productSchema from "./schema";

const samplePayload = {
	id: "prod-001",
	sku: "SKU-12345",
	price: 199.99,
	tags: ["electronics", "gadget"]
} as const;

const validated = productSchema.assert(samplePayload);

console.log(`Validated product: ${validated.id}`);