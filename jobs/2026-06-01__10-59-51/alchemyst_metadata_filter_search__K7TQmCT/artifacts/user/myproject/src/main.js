"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@alchemystai/sdk");
async function main() {
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    const runId = process.env.ZEALT_RUN_ID;
    if (!apiKey) {
        console.error('ALCHEMYST_AI_API_KEY is not set');
        process.exit(1);
    }
    if (!runId) {
        console.error('ZEALT_RUN_ID is not set');
        process.exit(1);
    }
    const args = process.argv.slice(2);
    let group = '';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--group' && i + 1 < args.length) {
            group = args[i + 1];
            break;
        }
    }
    if (!group) {
        console.error('--group argument is required');
        process.exit(1);
    }
    const client = new sdk_1.AlchemystAI({ apiKey });
    const documents = [
        {
            content: "This is a support document 1.",
            metadata: {
                file_name: `support_doc_1_${runId}`,
                group_name: ["support"]
            }
        },
        {
            content: "This is a support document 2.",
            metadata: {
                file_name: `support_doc_2_${runId}`,
                group_name: ["support"]
            }
        },
        {
            content: "This is an engineering document 1.",
            metadata: {
                file_name: `engineering_doc_1_${runId}`,
                group_name: ["engineering"]
            }
        },
        {
            content: "This is an engineering document 2.",
            metadata: {
                file_name: `engineering_doc_2_${runId}`,
                group_name: ["engineering"]
            }
        }
    ];
    for (const doc of documents) {
        try {
            await client.v1.context.add({
                documents: [doc],
                context_type: 'resource',
                source: 'docs',
                scope: 'internal'
            });
            console.error(`Added document: ${doc.metadata.file_name}`);
        }
        catch (error) {
            if (error.status === 409 || error.message?.includes('409') || error.response?.status === 409) {
                console.error(`Document already exists (409): ${doc.metadata.file_name}`);
            }
            else {
                console.error(`Error adding document ${doc.metadata.file_name}:`, error.message);
            }
        }
    }
    // Sleep for a short while to allow for indexing
    await new Promise(resolve => setTimeout(resolve, 3000));
    try {
        const searchResult = await client.v1.context.search({
            query: "document",
            scope: 'internal',
            // The SDK types might expect a string 'true'|'false' for metadata,
            // but the API expects an object to filter by metadata.
            metadata: {
                groupName: [group]
            }
        });
        const fileNames = new Set();
        const contexts = searchResult.contexts || [];
        for (const ctx of contexts) {
            if (ctx.metadata && ctx.metadata.file_name) {
                fileNames.add(ctx.metadata.file_name);
            }
        }
        console.log(JSON.stringify(Array.from(fileNames)));
    }
    catch (error) {
        console.error("Search error:", error.message);
        process.exit(1);
    }
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map