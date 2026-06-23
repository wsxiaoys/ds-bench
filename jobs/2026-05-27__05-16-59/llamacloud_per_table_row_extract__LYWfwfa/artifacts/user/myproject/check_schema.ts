import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
const ProductSchema = z.object({
    product_code: z.string().describe("the unique product code (e.g., P001)"),
    product_name: z.string().describe("the product name"),
    category: z.string().describe("the product category (e.g., Beverages, Snacks)"),
    price_usd: z.number().describe("the unit price in USD"),
    stock: z.number().int().describe("the stock count"),
});
const raw_schema: any = zodToJsonSchema(ProductSchema);
delete raw_schema.$schema;
delete raw_schema.additionalProperties;
console.log(JSON.stringify(raw_schema, null, 2));
