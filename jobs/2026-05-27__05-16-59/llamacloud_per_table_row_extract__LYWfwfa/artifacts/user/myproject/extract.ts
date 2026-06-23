import { LlamaCloud } from '@llamaindex/llama-cloud';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as fs from 'fs';

async function main() {
    const apiKey = process.env.LLAMA_CLOUD_API_KEY;
    const runId = process.env.ZEALT_RUN_ID;

    if (!apiKey || !runId) {
        throw new Error("Missing LLAMA_CLOUD_API_KEY or ZEALT_RUN_ID");
    }

    const client = new LlamaCloud({
        token: apiKey,
    });

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

    const filePath = '/home/user/myproject/data/products.pdf';
    const externalFileId = `products-${runId}.pdf`;
    
    console.log("Checking if file exists...");
    const files = await client.files.list({ external_file_id: externalFileId });
    let fileId;
    if (files.items && files.items.length > 0) {
        fileId = files.items[0].id;
        console.log("File already exists, ID:", fileId);
    } else {
        console.log("Uploading file...");
        const file = await client.files.create({
            file: fs.createReadStream(filePath) as any,
            purpose: 'extract',
            external_file_id: externalFileId
        });
        fileId = file.id;
        console.log("File uploaded, ID:", fileId);
    }

    console.log("Starting extraction job...");
    const job = await client.extract.create({
        file_input: fileId,
        configuration: {
            data_schema: raw_schema,
            extraction_target: "per_table_row",
            tier: "agentic"
        }
    });
    console.log("Job created, ID:", job.id);

    let currentJob = job;
    while (true) {
        if (["COMPLETED", "FAILED", "CANCELLED"].includes(currentJob.status)) {
            break;
        }
        console.log(`Job status: ${currentJob.status}. Waiting 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        currentJob = await client.extract.get(job.id);
    }

    console.log("Job finished with status:", currentJob.status);
    if (currentJob.status !== "COMPLETED") {
        console.error("Job details:", JSON.stringify(currentJob, null, 2));
        throw new Error(`Job failed with status: ${currentJob.status}`);
    }

    const results = currentJob.extract_result;
    
    fs.writeFileSync('/home/user/myproject/output.json', JSON.stringify(results, null, 2), 'utf-8');
    
    const count = Array.isArray(results) ? results.length : 0;
    fs.appendFileSync('/home/user/myproject/output.log', `Extracted rows: ${count}\n`);
    console.log(`Saved ${count} rows.`);
}

main().catch(console.error);
