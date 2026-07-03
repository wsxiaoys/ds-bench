import { declare, type } from "arktype";
import type { Product } from "./types";

// Try using declare directly
const parser = declare<Product>();
console.log('parser type:', typeof parser);
console.log('parser keys:', Object.keys(parser));

// Try the call form
try {
  const schema = parser({ id: "string", sku: "string", price: "number", tags: "string[]" });
  console.log('schema:', typeof schema);
} catch(e) {
  console.log('error:', (e as Error).message);
}
