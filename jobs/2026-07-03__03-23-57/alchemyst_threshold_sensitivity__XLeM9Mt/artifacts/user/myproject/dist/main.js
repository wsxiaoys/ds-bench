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
    // 1. Read API key from environment
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey) {
        console.error("Error: ALCHEMYST_AI_API_KEY environment variable is not set.");
        process.exit(1);
    }
    // 2. Parse CLI arguments
    const args = process.argv.slice(2);
    const thresholdsIndex = args.indexOf('--thresholds');
    if (thresholdsIndex === -1 || !args[thresholdsIndex + 1]) {
        console.error("Error: --thresholds <csv> argument is required.");
        console.error("Usage: node dist/main.js --thresholds 0.5,0.7,0.9");
        process.exit(1);
    }
    const thresholdsStr = args[thresholdsIndex + 1];
    const thresholds = thresholdsStr.split(',').map(s => {
        const val = parseFloat(s.trim());
        if (isNaN(val) || val < 0 || val > 1) {
            console.error(`Error: Invalid threshold value "${s}". Must be a number between 0 and 1.`);
            process.exit(1);
        }
        return val;
    });
    // 3. Read run-id
    let runId = 'default-run-id';
    try {
        const runIdPath = '/logs/artifacts/run-id';
        if (fs.existsSync(runIdPath)) {
            runId = fs.readFileSync(runIdPath, 'utf8').trim();
        }
        else {
            console.error(`Warning: /logs/artifacts/run-id does not exist, using default run-id.`);
        }
    }
    catch (err) {
        console.error(`Warning: Could not read run-id from /logs/artifacts/run-id: ${err}`);
    }
    console.error(`Using run-id: ${runId}`);
    // 4. Initialize Alchemyst AI client
    const client = new sdk_1.default({ apiKey });
    // 5. Define corpus documents with varied semantic relevance
    const query = "What is the refund policy for Alchemyst AI?";
    const documents = [
        {
            content: "The refund policy of Alchemyst AI provides a full refund within 30 days of purchase. To request a refund, contact support@example.com. This policy ensures customer satisfaction across all subscription tiers.",
            metadata: {
                file_name: `threshold_doc_1_${runId}.md`
            }
        },
        {
            content: "Our billing system handles all subscription cancellations, refunds, and payments. Customers can request billing adjustments or support regarding their invoices by emailing billing@example.com. We review payment issues on a case-by-case basis.",
            metadata: {
                file_name: `threshold_doc_2_${runId}.md`
            }
        },
        {
            content: "Our company policy outlines standard office procedures, employee conduct, and data security guidelines. The policies are reviewed annually by the board to maintain high operational standards.",
            metadata: {
                file_name: `threshold_doc_3_${runId}.md`
            }
        },
        {
            content: "The Alchemyst AI platform provides various context-aware services and intelligent agents. Developers can build agents using our SDKs and APIs to REDACTEDmate complex workflows and retrieve stored information.",
            metadata: {
                file_name: `threshold_doc_4_${runId}.md`
            }
        },
        {
            content: "Photosynthesis is the biological process used by plants and other organisms to convert light energy into chemical energy, which is later released to fuel the organisms' activities.",
            metadata: {
                file_name: `threshold_doc_5_${runId}.md`
            }
        }
    ];
    // 6. Ingest documents idempotently
    console.error("Ingesting corpus documents...");
    try {
        await client.v1.context.add({
            documents: documents, // Cast to any to avoid strict typing discrepancy in SDK version
            context_type: 'resource',
            source: 'documentation',
            scope: 'internal'
        });
        console.error("Successfully ingested documents.");
    }
    catch (error) {
        const isConflict = error.status === 409 ||
            error.statusCode === 409 ||
            error.code === 'CONFLICT' ||
            (error.message && error.message.includes('409')) ||
            (error.error && typeof error.error === 'string' && error.error.includes('already exists'));
        if (isConflict) {
            console.error("Documents already exist (409 Conflict). Continuing to search phase...");
        }
        else {
            console.error("Failed to ingest documents:", error);
            process.exit(1);
        }
    }
    // 7. Perform searches across requested thresholds
    const results = [];
    for (const threshold of thresholds) {
        console.error(`Searching with threshold: ${threshold}...`);
        try {
            const searchResult = await client.v1.context.search({
                query: query,
                similarity_threshold: threshold,
                minimum_similarity_threshold: 0.0, // Constant minimum threshold
                scope: 'internal'
            }); // Cast to any to ensure safety against strict SDK typing differences
            const contexts = searchResult.contexts || [];
            console.error(`Found ${contexts.length} contexts for threshold ${threshold}`);
            results.push({
                threshold: threshold,
                count: contexts.length
            });
        }
        catch (error) {
            console.error(`Search failed for threshold ${threshold}:`, error);
            process.exit(1);
        }
    }
    // 8. Print exactly one JSON object to stdout
    const output = {
        query: query,
        results: results
    };
    console.log(JSON.stringify(output, null, 2));
}
main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
