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
const KEYS = ["ENG_V1_DOC", "ENG_V2_DOC", "PRODUCT_V1_DOC", "PRODUCT_V2_DOC"];
async function main() {
    // 1. Read run-id
    let runId = process.env.RUN_ID || "";
    if (!runId) {
        try {
            runId = fs.readFileSync("/logs/artifacts/run-id", "utf8").trim();
        }
        catch (err) {
            runId = "default-run-id";
        }
    }
    console.error(`Using run-id: ${runId}`);
    // 2. Parse CLI groups from positional arguments after --groups
    const groupsIndex = process.argv.indexOf('--groups');
    const cliGroups = [];
    if (groupsIndex !== -1) {
        for (let i = groupsIndex + 1; i < process.argv.length; i++) {
            const arg = process.argv[i];
            if (arg.startsWith('--')) {
                break;
            }
            cliGroups.push(arg);
        }
    }
    console.error(`CLI Groups:`, cliGroups);
    // 3. Initialize Alchemyst AI Client
    const client = new sdk_1.default({
        apiKey: process.env.ALCHEMYST_AI_API_KEY,
    });
    // 4. Define the 4 seed documents
    const seedDocs = [
        {
            key: "ENG_V1_DOC",
            content: `API version 1 engineering notes. Key: ENG_V1_DOC. Run-id: ${runId}`,
            groups: ["eng", "v1"]
        },
        {
            key: "ENG_V2_DOC",
            content: `API version 2 engineering notes. Key: ENG_V2_DOC. Run-id: ${runId}`,
            groups: ["eng", "v2"]
        },
        {
            key: "PRODUCT_V1_DOC",
            content: `Product notes for release version 1. Key: PRODUCT_V1_DOC. Run-id: ${runId}`,
            groups: ["product", "v1"]
        },
        {
            key: "PRODUCT_V2_DOC",
            content: `Product notes for release version 2. Key: PRODUCT_V2_DOC. Run-id: ${runId}`,
            groups: ["product", "v2"]
        }
    ];
    // 5. Ingest the seed corpus
    for (const doc of seedDocs) {
        try {
            console.error(`Ingesting ${doc.key}...`);
            await client.v1.context.add({
                documents: [{
                        content: doc.content,
                        metadata: {
                            file_name: `${doc.key}-${runId}.md`,
                            group_name: doc.groups,
                            groupName: doc.groups
                        }
                    }],
                metadata: {
                    fileName: `${doc.key}-${runId}.md`,
                    fileSize: doc.content.length,
                    fileType: "text/markdown",
                    lastModified: new Date().toISOString(),
                    group_name: doc.groups,
                    groupName: doc.groups
                },
                context_type: 'resource',
                source: `context-arithmetic-${runId}`,
                scope: 'internal'
            });
            console.error(`Successfully ingested ${doc.key}`);
        }
        catch (error) {
            if (error.status === 409 || error.code === 'CONFLICT' || (error.message && error.message.includes('already exists'))) {
                console.error(`Document ${doc.key} already exists (409), tolerating and continuing.`);
            }
            else {
                console.error(`Error ingesting ${doc.key}:`, error);
                throw error;
            }
        }
    }
    // 6. Perform Context Arithmetic search
    console.error(`Searching Alchemyst with broad query 'notes'...`);
    const searchRes = await client.v1.context.search({
        query: "notes",
        similarity_threshold: 0.1,
        minimum_similarity_threshold: 0.1,
        scope: 'internal',
        metadata: { groupName: cliGroups },
        body_metadata: { groupName: cliGroups }
    }, {
        query: { metadata: 'true' }
    });
    // 7. Parse, filter, and deduplicate results
    const contexts = searchRes.contexts || [];
    const matchedKeys = new Set();
    for (const ctx of contexts) {
        const content = ctx.content || "";
        const fileName = ctx.metadata?.file_name || "";
        let foundKey = null;
        for (const doc of seedDocs) {
            if (content.includes(doc.key) || fileName.includes(doc.key)) {
                foundKey = doc.key;
                break;
            }
        }
        if (foundKey) {
            const docGroups = seedDocs.find(d => d.key === foundKey).groups;
            const matchesAll = cliGroups.every(g => docGroups.includes(g));
            if (matchesAll) {
                matchedKeys.add(foundKey);
            }
        }
    }
    const finalResults = Array.from(matchedKeys).map(key => ({ key }));
    console.log(JSON.stringify(finalResults));
}
main().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
