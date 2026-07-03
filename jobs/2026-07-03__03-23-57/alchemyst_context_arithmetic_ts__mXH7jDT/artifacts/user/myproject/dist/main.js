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
const sdk_1 = __importDefault(require("@alchemystai/sdk"));
const fs = __importStar(require("fs"));
function getRunId() {
    // Try reading from environment variable if set
    if (process.env['/logs/artifacts/run-id']) {
        return process.env['/logs/artifacts/run-id'].trim();
    }
    if (process.env.RUN_ID) {
        return process.env.RUN_ID.trim();
    }
    // Try reading from the file path /logs/artifacts/run-id
    try {
        if (fs.existsSync('/logs/artifacts/run-id')) {
            return fs.readFileSync('/logs/artifacts/run-id', 'utf-8').trim();
        }
    }
    catch (err) {
        // Ignore error
    }
    return 'default-run-id';
}
async function main() {
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey) {
        console.error("Error: ALCHEMYST_AI_API_KEY environment variable is not set.");
        process.exit(1);
    }
    const runId = getRunId();
    console.error(`Using runId: ${runId}`);
    // Parse command line arguments
    // Example: node dist/main.js --groups eng v1
    const groupsIndex = process.argv.indexOf('--groups');
    const groups = groupsIndex !== -1 ? process.argv.slice(groupsIndex + 1) : [];
    console.error(`Filtering by groups:`, groups);
    const client = new sdk_1.default({
        apiKey: apiKey,
    });
    const source = `cli-run-${runId}`;
    // 1. Attempt to delete existing documents from the same source to prevent conflict
    try {
        console.error(`Attempting to clean up existing documents for source: ${source}`);
        await client.v1.context.delete({
            source: source,
            by_doc: true,
        });
        console.error("Cleanup successful or no existing documents found.");
    }
    catch (error) {
        console.error("Cleanup note (can be ignored):", error);
    }
    // 2. Ingest the fixed seed corpus of 4 documents
    const documents = [
        {
            content: "This document contains engineering notes for API version 1. Key: ENG_V1_DOC.",
            metadata: {
                file_name: `ENG_V1_DOC-${runId}.md`,
                group_name: ["eng", "v1"]
            }
        },
        {
            content: "This document contains engineering notes for API version 2. Key: ENG_V2_DOC.",
            metadata: {
                file_name: `ENG_V2_DOC-${runId}.md`,
                group_name: ["eng", "v2"]
            }
        },
        {
            content: "This document contains product notes for release version 1. Key: PRODUCT_V1_DOC.",
            metadata: {
                file_name: `PRODUCT_V1_DOC-${runId}.md`,
                group_name: ["product", "v1"]
            }
        },
        {
            content: "This document contains product notes for release version 2. Key: PRODUCT_V2_DOC.",
            metadata: {
                file_name: `PRODUCT_V2_DOC-${runId}.md`,
                group_name: ["product", "v2"]
            }
        }
    ];
    console.error("Ingesting seed corpus...");
    try {
        await client.v1.context.add({
            documents: documents,
            context_type: 'resource',
            source: source,
            scope: 'internal'
        });
        console.error("Seed corpus successfully ingested.");
    }
    catch (error) {
        if (error?.status === 409 || error?.code === 'CONFLICT' || String(error).includes('409') || String(error).includes('CONFLICT')) {
            console.error("Conflict detected while adding documents, tolerating and continuing:", error);
        }
        else {
            console.error("Error during ingestion:", error);
            throw error;
        }
    }
    // 3. Perform Context Arithmetic intersection search
    console.error("Searching with Context Arithmetic...");
    // Choose a similarity_threshold low enough so semantic filter does not exclude valid members
    const searchParams = {
        query: "document notes version Key",
        similarity_threshold: 0.1,
        minimum_similarity_threshold: 0.05,
        scope: 'internal'
    };
    // The search must use the camelCase TypeScript SDK form: metadata: { groupName: [...] }
    if (groups.length > 0) {
        searchParams.metadata = {
            groupName: groups
        };
    }
    let contexts = [];
    try {
        const response = await client.v1.context.search(searchParams);
        contexts = response.contexts || [];
        console.error(`Search completed. Found ${contexts.length} chunks.`);
    }
    catch (error) {
        console.error("Search failed:", error);
        throw error;
    }
    // 4. Map back to the keys and deduplicate
    const keys = ["ENG_V1_DOC", "ENG_V2_DOC", "PRODUCT_V1_DOC", "PRODUCT_V2_DOC"];
    const matchedKeys = new Set();
    const results = [];
    for (const context of contexts) {
        const content = context.content || "";
        for (const key of keys) {
            if (content.includes(key)) {
                if (!matchedKeys.has(key)) {
                    matchedKeys.add(key);
                    results.push({
                        key,
                        content,
                        file_name: `${key}-${runId}.md`
                    });
                }
            }
        }
    }
    // Print precisely the JSON array to stdout
    process.stdout.write(JSON.stringify(results) + '\n');
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
