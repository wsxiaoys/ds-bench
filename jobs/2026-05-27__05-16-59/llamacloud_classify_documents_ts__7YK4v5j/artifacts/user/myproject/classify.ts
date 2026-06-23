import LlamaCloud from '@llamaindex/llama-cloud';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const client = new LlamaCloud();
    
    const sampleDir = path.join(process.cwd(), 'samples');
    const files = ['invoice.txt', 'receipt.txt', 'contract.txt'];
    
    // Upload files
    const fileIds: string[] = [];
    const fileIdToName = new Map<string, string>();
    
    for (const filename of files) {
        const filePath = path.join(sampleDir, filename);
        const fileStream = fs.createReadStream(filePath);
        const uploadedFile = await client.files.create({
            file: fileStream,
            purpose: 'classify'
        });
        fileIds.push(uploadedFile.id);
        fileIdToName.set(uploadedFile.id, filename);
    }
    
    // Submit classify job
    const result = await client.classifier.classify({
        file_ids: fileIds,
        rules: [
            { type: 'invoice', description: 'A commercial invoice with invoice number, bill-to section, line items, and totals' },
            { type: 'receipt', description: 'A point-of-sale receipt' },
            { type: 'contract', description: 'A legal services agreement with signatures' }
        ],
        mode: 'FAST'
    });
    
    // Write to output.log
    const runId = process.env.ZEALT_RUN_ID || 'unknown';
    const logLines: string[] = [];
    logLines.push(`Run ID: ${runId}`);
    
    // Create a map of file_id to result item for easy lookup
    const itemMap = new Map<string, any>();
    for (const item of result.items) {
        if (item.file_id) {
            itemMap.set(item.file_id, item);
        }
    }
    
    // Output in the same order as submitted
    for (const fileId of fileIds) {
        const item = itemMap.get(fileId);
        if (!item || !item.result) continue;
        
        const filename = fileIdToName.get(fileId) || 'unknown';
        const type = item.result.type;
        const confidence = item.result.confidence;
        logLines.push(`Classified: ${filename} | Type: ${type} | Confidence: ${confidence}`);
    }
    
    fs.writeFileSync('output.log', logLines.join('\n') + '\n');
}

main().catch(console.error);
