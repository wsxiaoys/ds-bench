"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const sdk_1 = __importDefault(require("@alchemystai/sdk"));
async function main() {
    // 1. Read run id
    const runIdPath = '/logs/artifacts/run-id';
    let runId = '';
    try {
        runId = fs.readFileSync(runIdPath, 'utf8').trim();
    }
    catch (err) {
        console.error(`Error reading run-id from ${runIdPath}:`, err);
        process.exit(1);
    }
    if (!runId) {
        console.error("Error: run-id is empty.");
        process.exit(1);
    }
    // 2. Read API key
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey) {
        console.error("Error: ALCHEMYST_AI_API_KEY environment variable is not set.");
        process.exit(1);
    }
    // 3. Parse CLI group argument
    const args = process.argv.slice(2);
    let group = '';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--group' && i + 1 < args.length) {
            group = args[i + 1].trim();
            break;
        }
    }
    if (!group) {
        console.error("Error: --group <group_name> is required.");
        process.exit(1);
    }
    // 4. Initialize Alchemyst client
    const client = new sdk_1.default({ apiKey });
    // 5. Define documents to seed
    const documents = [
        {
            content: `Support Document 1 for run ${runId}. This document contains instructions for user login troubleshooting, password resets, and account recovery.`,
            metadata: {
                file_name: `support_doc_1_${runId}.txt`,
                group_name: ["support"]
            }
        },
        {
            content: `Support Document 2 for run ${runId}. This document covers billing inquiries, invoices, payment methods, and refund policies.`,
            metadata: {
                file_name: `support_doc_2_${runId}.txt`,
                group_name: ["support"]
            }
        },
        {
            content: `Engineering Document 1 for run ${runId}. This document outlines the API integration architecture, endpoints, and design pattern guidelines.`,
            metadata: {
                file_name: `engineering_doc_1_${runId}.txt`,
                group_name: ["engineering"]
            }
        },
        {
            content: `Engineering Document 2 for run ${runId}. This document details database migration scripts, schema updates, and deployment pipelines.`,
            metadata: {
                file_name: `engineering_doc_2_${runId}.txt`,
                group_name: ["engineering"]
            }
        }
    ];
    // 6. Seed documents idempotently
    for (const doc of documents) {
        try {
            console.error(`Seeding document: ${doc.metadata.file_name}...`);
            await client.v1.context.add({
                documents: [doc],
                context_type: 'resource',
                source: 'docs',
                scope: 'internal'
            });
            console.error(`Successfully seeded: ${doc.metadata.file_name}`);
        }
        catch (error) {
            const isConflict = error instanceof sdk_1.default.ConflictError ||
                error.status === 409 ||
                error.statusCode === 409 ||
                error.response?.status === 409 ||
                error.message?.includes('409') ||
                error.message?.toLowerCase().includes('conflict') ||
                error.message?.toLowerCase().includes('already exists');
            if (isConflict) {
                console.error(`Document ${doc.metadata.file_name} already exists (409 conflict). Skipping seeding.`);
            }
            else {
                console.error(`Failed to seed ${doc.metadata.file_name}:`, error);
                throw error;
            }
        }
    }
    // 7. Search for context
    console.error(`Searching for context in group: ${group}...`);
    const query = group === 'support'
        ? `support user login billing refund troubleshooting ${runId}`
        : `engineering API integration architecture database migration deployment ${runId}`;
    try {
        const searchResult = await client.v1.context.search({
            query,
            scope: 'internal',
            similarity_threshold: 0.1, // Low threshold to ensure we match our documents
            metadata: {
                groupName: [group] // Use camelCase as per asymmetry requirement
            }
        });
        const contexts = (searchResult.contexts || []);
        console.error(`Search returned ${contexts.length} contexts.`);
        const fileNamesSet = new Set();
        for (const context of contexts) {
            if (context.content) {
                console.error(`Context content snippet: "${context.content.substring(0, 50)}..."`);
            }
            console.error("Context metadata:", JSON.stringify(context.metadata));
            const fileName = context.metadata?.file_name || context.metadata?.fileName;
            if (fileName) {
                fileNamesSet.add(fileName);
            }
        }
        const fileNamesArray = Array.from(fileNamesSet);
        // Only output the JSON array of strings to stdout
        console.log(JSON.stringify(fileNamesArray));
    }
    catch (error) {
        console.error("Failed to search context:", error);
        process.exit(1);
    }
}
main().catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
});
