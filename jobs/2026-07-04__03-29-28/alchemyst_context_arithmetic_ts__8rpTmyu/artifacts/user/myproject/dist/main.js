"use strict";
/**
 * Context Arithmetic Intersection Search demo for the Alchemyst AI service.
 *
 * This CLI:
 *   1. Connects to the real Alchemyst service using ALCHEMYST_AI_API_KEY.
 *   2. Ingests a fixed seed corpus of 4 overlapping documents.
 *   3. Runs an intersection search constrained by the groups passed via --groups.
 *   4. Prints the matched documents as a single JSON array on stdout.
 *
 * The TypeScript SDK is parameter-asymmetric:
 *   - `v1.context.add` accepts `metadata: { group_name: [...] }` (snake_case) for storage.
 *   - `v1.context.search` accepts `metadata: { groupName: [...] }` (camelCase) as a filter.
 *
 * The seed corpus uses these stable keys (also embedded in content for verification):
 *   - ENG_V1_DOC       groups [eng, v1]
 *   - ENG_V2_DOC       groups [eng, v2]
 *   - PRODUCT_V1_DOC   groups [product, v1]
 *   - PRODUCT_V2_DOC   groups [product, v2]
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
const sdk_1 = __importDefault(require("@alchemystai/sdk"));
const fs = __importStar(require("fs"));
const SEED_DOCS = [
    {
        key: 'ENG_V1_DOC',
        groups: ['eng', 'v1'],
        content: 'Engineering notes for API version 1. ' +
            'This document describes the engineering design decisions, ' +
            'internal endpoint behaviour, and platform-level implementation details ' +
            'for the v1 REST API surface. ENG_V1_DOC',
    },
    {
        key: 'ENG_V2_DOC',
        groups: ['eng', 'v2'],
        content: 'Engineering notes for API version 2. ' +
            'This document describes the engineering design decisions, ' +
            'internal endpoint behaviour, and platform-level implementation details ' +
            'for the v2 REST API surface with backwards-compatible semantics. ENG_V2_DOC',
    },
    {
        key: 'PRODUCT_V1_DOC',
        groups: ['product', 'v1'],
        content: 'Product notes for release version 1. ' +
            'This document captures product positioning, launch readiness, ' +
            'feature-set scope, customer-facing messaging, and market rollout ' +
            'plan for the v1 product release. PRODUCT_V1_DOC',
    },
    {
        key: 'PRODUCT_V2_DOC',
        groups: ['product', 'v2'],
        content: 'Product notes for release version 2. ' +
            'This document captures product positioning, launch readiness, ' +
            'feature-set scope, customer-facing messaging, and market rollout ' +
            'plan for the v2 product release. PRODUCT_V2_DOC',
    },
];
const KEY_REGEX = /\b(ENG_V1_DOC|ENG_V2_DOC|PRODUCT_V1_DOC|PRODUCT_V2_DOC)\b/;
const RUN_ID_DEFAULT_PATH = '/logs/artifacts/run-id';
const ENV_RUN_ID = 'RUN_ID';
/** Read the run identifier from the environment or the mounted artifact path. */
function readRunId() {
    const fromEnv = process.env[ENV_RUN_ID];
    if (fromEnv && fromEnv.trim().length > 0) {
        return fromEnv.trim();
    }
    try {
        const fromFile = fs.readFileSync(RUN_ID_DEFAULT_PATH, 'utf8').trim();
        if (fromFile.length > 0) {
            return fromFile;
        }
    }
    catch (_err) {
        // Fall through to synthesized id.
    }
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
/** Parse the CLI args of the form: --groups g1 g2 g3 ... */
function parseGroupArgs(argv) {
    const marker = '--groups';
    const idx = argv.indexOf(marker);
    if (idx === -1)
        return [];
    const groups = [];
    for (let i = idx + 1; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--'))
            break;
        groups.push(arg);
    }
    return groups;
}
async function addDocument(client, runId, doc) {
    const fileName = `${doc.key}-${runId}.md`;
    const lastModified = new Date().toISOString();
    const fileSize = Buffer.byteLength(doc.content, 'utf8');
    // The TypeScript SDK type definition for `metadata` only contains camelCase keys
    // (`fileName`, `groupName`, `fileSize`, `fileType`, `lastModified`). The
    // publicly documented Alchemyst REST API, however, is asymmetric:
    //   - storage (`v1.context.add`) accepts snake_case `group_name` (and `file_name`).
    //   - search (`v1.context.search`) accepts camelCase `groupName`.
    // We include BOTH spellings of file_name/group_name in the storage payload so
    // the engine indexes under the snake_case field (which is what search-time
    // filtering compares against) and we keep TypeScript happy via a localised cast.
    const typedMetadata = {
        fileName,
        fileType: 'text/markdown',
        fileSize,
        lastModified,
    };
    const snakeMetadata = {
        file_name: fileName,
        group_name: doc.groups,
    };
    try {
        await client.v1.context.add({
            context_type: 'resource',
            documents: [{ content: doc.content }],
            scope: 'internal',
            source: 'cli-context-arithmetic-demo',
            metadata: { ...typedMetadata, ...snakeMetadata },
        });
        return { ok: true };
    }
    catch (err) {
        const e = err;
        const status = e?.status ?? e?.statusCode ?? e?.code;
        // Tolerate duplicate-add (already ingested) so the CLI can be re-run safely.
        if (status === 409) {
            process.stderr.write(`Document '${fileName}' already exists (409 Conflict). Treating as idempotent.\n`);
            return { ok: true, status };
        }
        return { ok: false, status, message: e?.message ?? String(err) };
    }
}
async function run() {
    const filterGroups = parseGroupArgs(process.argv.slice(2));
    const runId = readRunId();
    if (!process.env.ALCHEMYST_AI_API_KEY) {
        process.stderr.write('Missing ALCHEMYST_AI_API_KEY environment variable.\n');
        process.exit(1);
    }
    const client = new sdk_1.default({ apiKey: process.env.ALCHEMYST_AI_API_KEY });
    process.stderr.write(`Run id: ${runId}\n` +
        `Filter groups: ${JSON.stringify(filterGroups)}\n` +
        `Seeding ${SEED_DOCS.length} documents...\n`);
    // 1) Ingest the seed corpus. Each document is identified by a stable
    //    `<KEY>-<run-id>.md` file_name to keep parallel runs isolated and to
    //    avoid 409 Conflict on re-runs that share a run-id.
    for (const doc of SEED_DOCS) {
        const outcome = await addDocument(client, runId, doc);
        if (!outcome.ok) {
            process.stderr.write(`Failed to add document '${doc.key}': status=${outcome.status} message=${outcome.message}\n`);
            // We deliberately continue on transient/per-doc failures so a single bad
            // add doesn't poison the whole CLI. The subsequent search will simply
            // exclude whichever document was not indexed.
        }
    }
    // 2) Context Arithmetic intersection search. The SDK is parameter-asymmetric:
    //    the storage call accepts `group_name` (snake_case), while the search
    //    filter inside `body_metadata` accepts `groupName` (camelCase). Passing
    //    the array of filter groups as `groupName` yields the set intersection.
    //
    //    Example:
    //      --groups eng v1  =>  docs whose storage groups are a *superset*
    //                          of {eng, v1} = only [eng, v1] = ENG_V1_DOC
    const searchBody = {
        query: 'engineering product notes API version release version architecture design implementation',
        similarity_threshold: 0.1,
        minimum_similarity_threshold: 0.05,
        scope: 'internal',
        body_metadata: { groupName: filterGroups },
    };
    // We also request `metadata=true` so the response includes each chunk's
    // stored metadata, from which we can extract `file_name` for verification.
    const searchResponse = await client.v1.context.search(searchBody, {
        query: { metadata: 'true' },
    });
    const contexts = (searchResponse.contexts ?? []);
    // 3) Build a deduplicated array keyed by the embedded `key` token. A single
    //    seed document can yield multiple chunks (and therefore multiple matches),
    //    so we only emit one record per key.
    const seen = new Set();
    const collected = [];
    for (const ctx of contexts) {
        const text = ctx.content ?? '';
        const match = text.match(KEY_REGEX);
        if (!match)
            continue;
        const key = match[1];
        if (seen.has(key))
            continue;
        seen.add(key);
        const md = ctx.metadata ?? {};
        collected.push({
            key,
            content: text,
            file_name: md.fileName ?? md.file_name,
            groups: md.group_name ?? md.groupName,
            score: ctx.score,
        });
    }
    // Stable ordering so the verifier can compare deterministically.
    collected.sort((a, b) => a.key.localeCompare(b.key));
    // Print exactly one JSON array on stdout. Logs go to stderr.
    process.stdout.write(JSON.stringify(collected));
}
run().catch((err) => {
    process.stderr.write(`Fatal: ${err?.message ?? String(err)}\n`);
    process.exit(1);
});
//# sourceMappingURL=main.js.map