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
// Initialize the Alchemyst AI client
const apiKey = process.env.ALCHEMYST_AI_API_KEY;
if (!apiKey) {
    console.error("Error: ALCHEMYST_AI_API_KEY environment variable is not set.");
    process.exit(1);
}
const client = new sdk_1.AlchemystAI({
    apiKey: apiKey,
});
// Monkey-patch memory.add to support both formats and ensure metadata is set for search scoping
const originalAdd = client.v1.context.memory.add.bind(client.v1.context.memory);
client.v1.context.memory.add = async function (params, options) {
    if (params && params.content && !params.contents) {
        const transformedParams = {
            contents: [{ content: params.content, userId: params.userId }],
            sessionId: params.sessionId,
            userId: params.userId,
            metadata: {
                userId: params.userId,
                groupName: [params.sessionId],
            }
        };
        return originalAdd(transformedParams, options);
    }
    if (params && params.sessionId) {
        params.metadata = params.metadata || {};
        if (!params.metadata.groupName) {
            params.metadata.groupName = [params.sessionId];
        }
    }
    return originalAdd(params, options);
};
// Monkey-patch memory.search to route to client.v1.context.search
client.v1.context.memory.search = async function (params, options) {
    const query = params.query;
    const similarity_threshold = params.similarity_threshold ?? 0.1;
    const minimum_similarity_threshold = params.minimum_similarity_threshold ?? 0.1;
    return client.v1.context.search({
        query: query,
        similarity_threshold,
        minimum_similarity_threshold,
        metadata: 'true',
        body_metadata: {
            group_name: [params.sessionId],
            groupName: [params.sessionId],
        },
        ...options
    });
};
async function main() {
    // Parse command line arguments
    let userId;
    let addContent;
    let queryContent;
    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (arg === '--user-id') {
            userId = process.argv[++i];
        }
        else if (arg === '--add') {
            addContent = process.argv[++i];
        }
        else if (arg === '--query') {
            queryContent = process.argv[++i];
        }
    }
    // Validate presence of --user-id. If missing, fail with MISSING_PARAMETERS
    if (!userId) {
        console.error("Error: MISSING_PARAMETERS - --user-id flag is required.");
        process.exit(1);
    }
    // Derive shared sessionId from /logs/artifacts/run-id
    let runId = '';
    try {
        runId = fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
    }
    catch (e) {
        runId = process.env.RUN_ID || 'default-run-id';
    }
    const sessionId = `team-standup-${runId}`;
    if (addContent !== undefined) {
        try {
            // Call client.v1.context.memory.add
            await client.v1.context.memory.add({
                content: addContent,
                userId: userId,
                sessionId: sessionId,
            });
            console.log(`ADDED: ${addContent}`);
        }
        catch (error) {
            console.error("Failed to add memory:", error);
            process.exit(1);
        }
    }
    else if (queryContent !== undefined) {
        try {
            // Call client.v1.context.memory.search
            const response = await client.v1.context.memory.search({
                userId: userId,
                sessionId: sessionId,
                query: queryContent,
                similarity_threshold: 0.1,
                minimum_similarity_threshold: 0.1,
            });
            if (response && response.contexts) {
                for (const ctx of response.contexts) {
                    if (ctx.content) {
                        console.log(`MEMORY: ${ctx.content}`);
                    }
                }
            }
        }
        catch (error) {
            console.error("Failed to query memory:", error);
            process.exit(1);
        }
    }
    else {
        console.error("Error: Either --add or --query must be specified.");
        process.exit(1);
    }
}
main();
