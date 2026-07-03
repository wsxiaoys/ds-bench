#!/usr/bin/env node
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
function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        const cur = argv[i];
        if (cur === '--user-id' && i + 1 < argv.length) {
            args.userId = argv[++i];
        }
        else if (cur.startsWith('--user-id=')) {
            args.userId = cur.substring('--user-id='.length);
        }
        else if (cur === '--add' && i + 1 < argv.length) {
            args.add = argv[++i];
        }
        else if (cur.startsWith('--add=')) {
            args.add = cur.substring('--add='.length);
        }
        else if (cur === '--query' && i + 1 < argv.length) {
            args.query = argv[++i];
        }
        else if (cur.startsWith('--query=')) {
            args.query = cur.substring('--query='.length);
        }
    }
    return args;
}
function getRunId() {
    try {
        const path = process.env.RUN_ID_FILE || '/logs/artifacts/run-id';
        return fs.readFileSync(path, 'utf8').trim();
    }
    catch (err) {
        if (process.env.RUN_ID)
            return process.env.RUN_ID.trim();
        return 'default-run';
    }
}
function getSessionId(runId) {
    return `team-standup-${runId}`;
}
function extractMemories(payload) {
    if (!payload)
        return [];
    const candidates = [
        payload?.memories,
        payload?.contexts,
        payload?.data?.memories,
        payload?.data?.contexts,
        payload?.results,
        payload?.data?.results,
    ];
    for (const c of candidates) {
        if (Array.isArray(c))
            return c;
        if (c && typeof c === 'object') {
            const arr = Object.values(c).find((v) => Array.isArray(v));
            if (Array.isArray(arr))
                return arr;
        }
    }
    return [];
}
function memoryContent(m) {
    if (m == null)
        return '';
    if (typeof m === 'string')
        return m;
    return (m.content ??
        m.memory ??
        m.text ??
        m.value ??
        m.message ??
        (m.metadata && (m.metadata.content || m.metadata.text)) ??
        JSON.stringify(m));
}
async function searchMemory(client, userId, sessionId, query) {
    // Per task spec: try client.v1.context.memory.search first.
    // Fall back to client.v1.context.search if not available.
    const memory = client.v1?.context?.memory;
    if (memory && typeof memory.search === 'function') {
        return await memory.search({
            userId,
            sessionId,
            query,
            similarity_threshold: 0.1,
            minimum_similarity_threshold: 0.1,
        });
    }
    // Fallback: context-level search (the SDK v0.11.1 API surface).
    return await client.v1.context.search({
        query,
        similarity_threshold: 0.1,
        minimum_similarity_threshold: 0.1,
        mode: 'standard',
        body_metadata: { userId, sessionId },
    });
}
async function addMemory(client, userId, sessionId, content) {
    // The SDK v0.11.1 expects { contents: [...], sessionId }.
    // We also include a messageId/userId so the contribution is identifiable.
    return await client.v1.context.memory.add({
        contents: [
            {
                content,
                metadata: {
                    messageId: `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    userId,
                },
            },
        ],
        sessionId,
        metadata: { groupName: [userId, sessionId, 'shared-team-memory'] },
    });
}
async function main() {
    const args = parseArgs(process.argv);
    if (!args.userId || args.userId.trim() === '') {
        console.error('MISSING_PARAMETERS: --user-id is required (userId and sessionId are mandatory for memory operations)');
        process.exit(1);
    }
    const runId = getRunId();
    const sessionId = getSessionId(runId);
    const userId = args.userId.trim();
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey) {
        console.error('ALCHEMYST_AI_API_KEY environment variable is not set');
        process.exit(1);
    }
    const client = new sdk_1.default({ apiKey });
    if (args.add !== undefined) {
        if (args.query !== undefined) {
            console.error('Use either --add or --query, not both');
            process.exit(1);
        }
        try {
            await addMemory(client, userId, sessionId, args.add);
            console.log(`ADDED: ${args.add}`);
            process.exit(0);
        }
        catch (err) {
            console.error(`ERROR: ${err?.message || String(err)}`);
            process.exit(1);
        }
    }
    if (args.query !== undefined) {
        try {
            const result = await searchMemory(client, userId, sessionId, args.query);
            const memories = extractMemories(result);
            for (const m of memories) {
                const content = memoryContent(m);
                if (content)
                    console.log(`MEMORY: ${content}`);
            }
            process.exit(0);
        }
        catch (err) {
            console.error(`ERROR: ${err?.message || String(err)}`);
            process.exit(1);
        }
    }
    console.error('MISSING_PARAMETERS: must provide either --add or --query (userId and sessionId are mandatory for memory operations)');
    process.exit(1);
}
main().catch((err) => {
    console.error(`FATAL: ${err?.message || String(err)}`);
    process.exit(1);
});
