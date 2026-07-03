import { z } from 'zod';

const schema = z.object({
  invoice_number: z.string(),
});

try {
  // @ts-ignore
  console.log(z.toJSONSchema);
  // @ts-ignore
  console.log(z.toJSONSchema(schema));
} catch (e) {
  console.error("Error calling z.toJSONSchema:", e);
}
