import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
const Invoice = z.object({
  vendor_name: z.string(),
  invoice_number: z.string(),
  total_amount: z.number(),
  currency: z.string().length(3),
});
const schema = zodToJsonSchema(Invoice);
console.log(JSON.stringify(schema, null, 2));
