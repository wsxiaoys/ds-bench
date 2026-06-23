import { LlamaCloud } from '@llamaindex/llama-cloud';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

async function main() {
    const client = new LlamaCloud({ token: process.env.LLAMA_CLOUD_API_KEY });
    const fileId = "5e740b83-dc9c-4197-bc4f-b4237c99fcde";

    const ProductSchema = z.object({
        product_code: z.string().describe("the unique product code (e.g., P001)"),
        product_name: z.string().describe("the product name"),
        category: z.string().describe("the product category (e.g., Beverages, Snacks)"),
        price_usd: z.number().describe("the unit price in USD"),
        stock: z.number().int().describe("the stock count"),
    });

    const data_schema = zodToJsonSchema(ProductSchema) as any;
    data_schema.properties.price_usd.type = ["number", "string"];
    data_schema.properties.stock.type = ["integer", "string"];

    console.log("Starting extraction job...");
    const job = await client.extract.create({
        file_input: fileId,
        configuration: {
            data_schema: data_schema,
            extraction_target: "per_table_row",
            tier: "agentic"
        }
    });

    let currentJob = job;
    while (true) {
        if (["COMPLETED", "FAILED", "CANCELLED"].includes(currentJob.status)) {
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        currentJob = await client.extract.get(job.id);
    }
    console.log("Job status:", currentJob.status);
    console.log("Job result:", JSON.stringify(currentJob.extract_result, null, 2));
    if (currentJob.status === "FAILED") {
        console.log("Error:", currentJob.error_message);
    }
}
main().catch(console.error);
