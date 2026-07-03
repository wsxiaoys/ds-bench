#!/usr/bin/env node
"use strict";
/**
 * Alchemyst Context Arithmetic Intersection Search CLI
 *
 * Demonstrates the parameter casing difference between writing and reading
 * group metadata in @alchemystai/sdk:
 *  - v1.context.add  -> metadata.group_name (snake_case) when ingesting
 *  - v1.context.search -> metadata.groupName (camelCase) when filtering
 *
 * Usage:
 *   node dist/main.js --groups eng v1
 *
 * Outputs a single JSON array on stdout containing the deduplicated matched
 * documents (each with at least a `key` field).
 */
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
const SEED = [
    {
        key: 'ENG_V1_DOC',
        groups: ['eng', 'v1'],
        content: 'ENG_V1_DOC: Engineering notes for API version 1. ' +
            'This document covers the original REST API surface introduced in v1, ' +
            'including endpoints, authentication via API keys, request/response ' +
            'schemas, rate limiting, and deprecation policy for v1 endpoints.',
    },
    {
        key: 'ENG_V2_DOC',
        groups: ['eng', 'v2'],
        content: 'ENG_V2_DOC: Engineering notes for API version 2. ' +
            'This document covers the v2 release of the API: new endpoints, ' +
            'breaking changes vs v1, JSON-only payloads, OAuth2 auth, versioning ' +
            'headers, and migration guidance for clients still on v1.',
    },
    {
        key: 'PRODUCT_V1_DOC',
        groups: ['product', 'v1'],
        content: 'PRODUCT_V1_DOC: Product notes for release version 1. ' +
            'This document covers the v1 product launch: positioning, target ' +
            'customers, core feature set, pricing tiers, launch checklist, ' +
            'success metrics, and roadmap inputs that fed into the v1 release.',
    },
    {
        key: 'PRODUCT_V2_DOC',
        groups: ['product', 'v2'],
        content: 'PRODUCT_V2_DOC: Product notes for release version 2. ' +
            'This document covers the v2 product release: new positioning, ' +
            'expanded ICP, new features beyond v1, updated pricing, GTM plan, ' +
            'launch readiness review, and what we learned from v1 customers.',
    },
];
// ----- CLI parsing -----
function parseArgs(argv) {
    const groups = [];
    let i = 0;
    while (i < argv.length) {
        const a = argv[i];
        if (a === '--groups') {
            i++;
            while (i < argv.length && !argv[i].startsWith('--')) {
                groups.push(argv[i]);
                i++;
            }
        }
        else {
            // ignore unknown flags
            i++;
        }
    }
    return groups;
}
// ----- Run-id resolution -----
function resolveRunId() {
    const envRunId = process.env.RUN_ID;
    if (envRunId && envRunId.length > 0)
        return envRunId;
    const filePath = '/logs/artifacts/run-id';
    try {
        const txt = fs.readFileSync(filePath, 'utf8').trim();
        if (txt.length > 0)
            return txt;
    }
    catch (_) {
        // fall through
    }
    return `local-${Date.now()}`;
}
// ----- Helpers -----
function extractKeyFromContent(content) {
    const m = content.match(/\b(ENG_V1_DOC|ENG_V2_DOC|PRODUCT_V1_DOC|PRODUCT_V2_DOC)\b/);
    return m ? m[1] : null;
}
function extractKeyFromMeta(meta) {
    if (!meta || typeof meta !== 'object')
        return null;
    const m = meta;
    const fileName = m['fileName'] ?? m['file_name'];
    if (typeof fileName === 'string') {
        const m2 = fileName.match(/^(ENG_V1_DOC|ENG_V2_DOC|PRODUCT_V1_DOC|PRODUCT_V2_DOC)-/);
        if (m2)
            return m2[1];
    }
    // also accept a direct `key` field if present
    const directKey = m['key'];
    if (typeof directKey === 'string' && /^(ENG|PRODUCT)_/.test(directKey))
        return directKey;
    return null;
}
async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
// ----- Main -----
async function main() {
    const groups = parseArgs(process.argv.slice(2));
    if (groups.length === 0) {
        process.stderr.write('Usage: node dist/main.js --groups <g1> [g2] ...\n');
        process.exit(2);
    }
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey || apiKey.length === 0) {
        process.stderr.write('ALCHEMYST_AI_API_KEY is not set\n');
        process.exit(2);
    }
    const runId = resolveRunId();
    process.stderr.write(`[alchemyst-cli] run-id=${runId} groups=[${groups.join(',')}]\n`);
    const client = new sdk_1.default({ apiKey });
    // ----- Ingest the seed corpus -----
    // The task spec requires using group_name (snake_case) when adding documents,
    // because the TypeScript SDK is parameter-asymmetric between write/read.
    for (const doc of SEED) {
        const fileName = `${doc.key}-${runId}.md`;
        try {
            await client.v1.context.add({
                documents: [{ content: doc.content }],
                context_type: 'resource',
                source: `alchemyst-cli-${runId}`,
                scope: 'internal',
                metadata: {
                    fileName,
                    fileType: 'text/markdown',
                    // INTENTIONAL snake_case per the task spec quirk:
                    // use `group_name` (not `groupName`) on add.
                    group_name: doc.groups,
                    lastModified: new Date().toISOString(),
                    fileSize: doc.content.length,
                    // We also keep a `key` field for easier verification on read.
                    key: doc.key,
                },
            });
            process.stderr.write(`[alchemyst-cli] added ${doc.key} as ${fileName}\n`);
        }
        catch (err) {
            // Tolerate 409 conflict on re-runs of the same run-id.
            const status = err?.status ?? err?.statusCode ?? err?.response?.status;
            const msg = err?.message ?? String(err);
            if (status === 409 || /409|conflict/i.test(msg)) {
                process.stderr.write(`[alchemyst-cli] ${doc.key} already exists (409) - skipping\n`);
            }
            else {
                process.stderr.write(`[alchemyst-cli] failed to add ${doc.key}: ${msg}\n`);
            }
        }
    }
    // Give the backend a moment to index the documents before searching.
    await sleep(1500);
    // ----- Context Arithmetic intersection search -----
    // The task spec requires camelCase groupName on search.
    const query = 'engineering product API release version v1 v2 notes documentation';
    let rawContexts = [];
    let lastErr = null;
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            const resp = await client.v1.context.search({
                query,
                similarity_threshold: 0.5,
                minimum_similarity_threshold: 0.1,
                scope: 'internal',
                // ask the API to include metadata so we can recover the key.
                metadata: 'true',
                mode: 'standard',
                // CamelCase `groupName` per the task spec quirk on search.
                body_metadata: {
                    groupName: groups,
                },
            });
            rawContexts = (resp?.contexts ?? []);
            break;
        }
        catch (err) {
            lastErr = err;
            process.stderr.write(`[alchemyst-cli] search attempt ${attempt + 1} failed: ${err?.message ?? String(err)}\n`);
            await sleep(1500 * (attempt + 1));
        }
    }
    if (rawContexts.length === 0 && lastErr) {
        process.stderr.write(`[alchemyst-cli] search ultimately failed: ${lastErr?.message ?? lastErr}\n`);
    }
    // ----- Deduplicate and shape the output -----
    const seen = new Set();
    const results = [];
    for (const ctx of rawContexts) {
        const content = typeof ctx?.content === 'string' ? ctx.content : '';
        const meta = ctx?.metadata;
        const keyFromMeta = extractKeyFromMeta(meta);
        const keyFromContent = extractKeyFromContent(content);
        const key = keyFromMeta ?? keyFromContent;
        if (!key)
            continue;
        if (seen.has(key))
            continue;
        seen.add(key);
        const result = { key };
        if (content)
            result.content = content;
        if (meta && typeof meta === 'object')
            result.metadata = meta;
        if (typeof ctx?.score === 'number')
            result.score = ctx.score;
        // also include file_name when available for verifiability
        const fileName = (meta && typeof meta === 'object' && meta.fileName) ||
            (meta && typeof meta === 'object' && meta.file_name) ||
            undefined;
        if (fileName)
            result.file_name = fileName;
        results.push(result);
    }
    // Single JSON array on stdout, nothing else.
    process.stdout.write(JSON.stringify(results));
}
main().catch((err) => {
    process.stderr.write(`[alchemyst-cli] fatal: ${err?.stack ?? err?.message ?? err}\n`);
    process.exit(1);
});
//# sourceMappingURL=main.js.map