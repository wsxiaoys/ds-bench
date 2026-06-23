import fs from 'fs';
import path from 'path';
import { LlamaCloud } from '@llamaindex/llama-cloud';
import { z } from 'zod';
import pLimit from 'p-limit';
import { zodToJsonSchema } from 'zod-to-json-schema';

const runId = process.env.ZEALT_RUN_ID;
if (!runId) {
    console.error("Missing ZEALT_RUN_ID");
    process.exit(1);
}

const client = new LlamaCloud();
const limit = pLimit(2);

// Schemas
const InvoiceSchema = z.object({
    invoice_number: z.string(),
    vendor_name: z.string(),
    total_amount: z.number(),
    line_items: z.array(z.object({
        description: z.string(),
        quantity: z.number(),
        unit_price: z.number(),
        total: z.number()
    }))
});

const ContractSchema = z.object({
    parties: z.array(z.string()).min(2),
    effective_date: z.string(),
    term: z.string()
});

const InvoiceJSONSchema = zodToJsonSchema(InvoiceSchema);
const ContractJSONSchema = zodToJsonSchema(ContractSchema);

async function main() {
    const inputsDir = path.join(process.cwd(), 'inputs');
    const files = fs.readdirSync(inputsDir).filter(f => f.endsWith('.pdf'));

    const uploadedFiles: { basename: string; file_id: string }[] = [];

    // Phase 1: Upload
    console.log("Uploading files...");
    for (const file of files) {
        const basename = file;
        const basenameWithoutExt = path.basename(file, '.pdf');
        const external_file_id = `${runId}-${basenameWithoutExt}`;
        const filePath = path.join(inputsDir, file);

        const uploadRes = await client.files.create({
            file: fs.createReadStream(filePath),
            external_file_id,
            purpose: 'extract' // Add purpose as required by the SDK type
        });

        uploadedFiles.push({
            basename,
            file_id: uploadRes.id
        });
        console.log(`Uploaded ${basename} -> ${uploadRes.id}`);
    }

    // Phase 1.5: Classify
    console.log("Classifying files...");
    const fileIds = uploadedFiles.map(f => f.file_id);
    const classifyRes = await client.classifier.classify({
        file_ids: fileIds,
        rules: [
            {
                type: 'invoice',
                description: 'commercial invoice with an invoice number, line items, and a grand total'
            },
            {
                type: 'contract',
                description: 'legal agreement signed by two or more parties with an effective date and term'
            }
        ],
        mode: 'FAST'
    });

    const classifyMap = new Map<string, { type: string; confidence: number }>();
    for (const item of classifyRes.items || []) {
        if (item.file_id && item.result) {
            classifyMap.set(item.file_id, {
                type: item.result.type!,
                confidence: item.result.confidence!
            });
        }
    }

    // Phase 2: Per-category Extract (concurrent)
    console.log("Extracting data...");
    
    const results: Record<string, any> = {};
    const logLines: string[] = [];

    const extractPromises = uploadedFiles.map(fileObj => limit(async () => {
        const classifyInfo = classifyMap.get(fileObj.file_id);
        if (!classifyInfo) {
            throw new Error(`No classification result for file ${fileObj.file_id}`);
        }

        const { type, confidence } = classifyInfo;
        const data_schema = type === 'invoice' ? InvoiceJSONSchema : ContractJSONSchema;

        console.log(`Starting extract for ${fileObj.basename} as ${type}...`);
        const extractJob = await client.extract.create({
            file_input: fileObj.file_id,
            configuration: {
                data_schema,
                extraction_target: 'per_doc',
                tier: 'agentic'
            }
        });

        let job = await client.extract.get(extractJob.id);
        while (job.status !== 'COMPLETED' && job.status !== 'FAILED' && job.status !== 'CANCELLED') {
            await new Promise(r => setTimeout(r, 2000));
            job = await client.extract.get(extractJob.id);
        }

        if (job.status !== 'COMPLETED') {
            throw new Error(`Extract job failed for ${fileObj.basename}: ${job.status}`);
        }

        const data = job.extract_result || {};
        const fieldsCount = Object.keys(data).length;

        results[fileObj.basename] = {
            category: type,
            confidence: confidence,
            file_id: fileObj.file_id,
            data
        };

        logLines.push(`Routed: ${fileObj.basename} | category: ${type} | confidence: ${confidence} | fields: ${fieldsCount}`);
        console.log(`Finished extract for ${fileObj.basename}`);
    }));

    await Promise.all(extractPromises);

    // Save outputs
    const outputsDir = path.join(process.cwd(), 'outputs');
    if (!fs.existsSync(outputsDir)) {
        fs.mkdirSync(outputsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(outputsDir, 'results.json'), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(process.cwd(), 'output.log'), logLines.join('\n') + '\n');
    
    console.log("Done!");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
