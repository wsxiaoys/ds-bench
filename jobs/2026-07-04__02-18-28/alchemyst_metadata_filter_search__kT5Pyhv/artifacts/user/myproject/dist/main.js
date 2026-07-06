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
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@alchemystai/sdk");
const fs = __importStar(require("fs"));
async function main() {
    // 1. Read API Key
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey) {
        console.error("Error: ALCHEMYST_AI_API_KEY environment variable is not set.");
        process.exit(1);
    }
    // 2. Read Run ID
    let runId = '';
    try {
        runId = fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
    }
    catch (err) {
        console.error("Error: Failed to read run-id from /logs/artifacts/run-id:", err.message);
        process.exit(1);
    }
    if (!runId) {
        console.error("Error: Run ID is empty.");
        process.exit(1);
    }
    // 3. Parse CLI Arguments
    const args = process.argv.slice(2);
    let group;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--group' && i + 1 < args.length) {
            group = args[i + 1];
            break;
        }
    }
    if (!group) {
        console.error("Error: --group <group_name> is required.");
        process.exit(1);
    }
    // 4. Initialize Alchemyst AI Client
    const client = new sdk_1.AlchemystAI({ apiKey });
    // 5. Define 4 Resource Documents to Seed
    const docsToSeed = [
        {
            file_name: `support_doc_1_${runId}`,
            group_name: ["support"],
            content: "Support document 1: How to reset your password. To reset your password, click on the forgot password link on the login page."
        },
        {
            file_name: `support_doc_2_${runId}`,
            group_name: ["support"],
            content: "Support document 2: Billing policy details. We bill on a monthly subscription basis. You can cancel your subscription at any time."
        },
        {
            file_name: `engineering_doc_1_${runId}`,
            group_name: ["engineering"],
            content: "Engineering document 1: Deploying to Kubernetes. We use Helm charts to deploy our microservices to Kubernetes clusters in production."
        },
        {
            file_name: `engineering_doc_2_${runId}`,
            group_name: ["engineering"],
            content: "Engineering document 2: Database migration guide. Run npm run db:migrate to apply the latest migrations to your PostgreSQL database."
        }
    ];
    // 6. Seed Documents Idempotently
    console.error(`Seeding 4 documents with run-id suffix: ${runId}...`);
    for (const doc of docsToSeed) {
        try {
            console.error(`Seeding document: ${doc.file_name} for group: ${doc.group_name.join(', ')}`);
            await client.v1.context.add({
                context_type: 'resource',
                source: 'docs',
                scope: 'internal',
                metadata: {
                    fileName: doc.file_name,
                    fileSize: Buffer.byteLength(doc.content),
                    fileType: 'text/plain',
                    lastModified: new Date().toISOString(),
                    groupName: doc.group_name
                },
                documents: [
                    {
                        content: doc.content,
                        metadata: {
                            file_name: doc.file_name,
                            group_name: doc.group_name
                        }
                    }
                ]
            });
            console.error(`Successfully seeded: ${doc.file_name}`);
        }
        catch (err) {
            if (err.status === 409 || err.statusCode === 409 || (err.message && err.message.includes('409'))) {
                console.error(`Document ${doc.file_name} already seeded (409 conflict).`);
            }
            else {
                console.error(`Failed to seed ${doc.file_name}:`, err);
                process.exit(1);
            }
        }
    }
    // 7. Perform Metadata-Filtered Context Search
    console.error(`Performing filtered search for group: ${group}...`);
    try {
        const searchRes = await client.v1.context.search({
            query: `${group} document`,
            scope: 'internal',
            minimum_similarity_threshold: 0.05,
            similarity_threshold: 0.05,
            metadata: 'true',
            body_metadata: { groupName: [group] }
        });
        // 8. Deduplicate and Print File Names as JSON Array on stdout
        const fileNames = new Set();
        if (searchRes.contexts && Array.isArray(searchRes.contexts)) {
            for (const context of searchRes.contexts) {
                const meta = context.metadata;
                if (meta && meta.file_name) {
                    fileNames.add(meta.file_name);
                }
            }
        }
        const output = Array.from(fileNames);
        console.log(JSON.stringify(output));
    }
    catch (err) {
        console.error("Search failed:", err);
        process.exit(1);
    }
}
main().catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
});
