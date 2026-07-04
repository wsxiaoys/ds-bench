#!/usr/bin/env node
"use strict";
/**
 * Context Arithmetic Intersection Search CLI
 *
 * Demonstrates the Alchemyst TypeScript SDK's Context Arithmetic intersection
 * semantics end-to-end against the real Alchemyst service.
 *
 * Usage:
 *   node dist/main.js --groups eng v1
 *
 * Behavior:
 *   1. Connects to Alchemyst using ALCHEMYST_AI_API_KEY.
 *   2. Ingests a fixed seed corpus of 4 documents with overlapping group_name metadata.
 *   3. Performs a Context Arithmetic intersection search constrained to the groups
 *      passed on the command line (using the camelCase `groupName` search form).
 *   4. Prints the matched documents to stdout as a single JSON array.
 *
 * Notes on the SDK parameter-asymmetry quirk:
 *   - Adding documents  -> metadata field is `group_name` (snake_case)
 *   - Searching          -> metadata field is `groupName`   (camelCase)
 *
 * All progress/diagnostic messages are written to stderr so that stdout contains
 * exactly one JSON array that can be parsed cleanly by a verifier.
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
const sdk_2 = require("@alchemystai/sdk");
// ---------------------------------------------------------------------------
// Seed corpus
// ---------------------------------------------------------------------------
const SEED_CORPUS = [
    {
        key: 'ENG_V1_DOC',
        groups: ['eng', 'v1'],
        content: 'ENG_V1_DOC: Engineering notes for API version 1. ' +
            'This document describes the engineering architecture, endpoints, and design ' +
            'decisions for the v1 engineering API. Key engineering topics include request ' +
            'handling, authentication flows, error handling, and data models for version 1.',
    },
    {
        key: 'ENG_V2_DOC',
        groups: ['eng', 'v2'],
        content: 'ENG_V2_DOC: Engineering notes for API version 2. ' +
            'This document describes the engineering architecture, endpoints, and design ' +
            'decisions for the v2 engineering API. Key engineering topics include request ' +
            'handling, authentication flows, error handling, and data models for version 2.',
    },
    {
        key: 'PRODUCT_V1_DOC',
        groups: ['product', 'v1'],
        content: 'PRODUCT_V1_DOC: Product notes for release version 1. ' +
            'This document describes the product roadmap, features, and user experience ' +
            'decisions for the v1 product release. Key product topics include feature sets, ' +
            'user stories, launch plans, and release notes for version 1.',
    },
    {
        key: 'PRODUCT_V2_DOC',
        groups: ['product', 'v2'],
        content: 'PRODUCT_V2_DOC: Product notes for release version 2. ' +
            'This document describes the product roadmap, features, and user experience ' +
            'decisions for the v2 product release. Key product topics include feature sets, ' +
            'user stories, launch plans, and release notes for version 2.',
    },
];
const ALL_KEYS = SEED_CORPUS.map((d) => d.key);
// A broad query that loosely matches every seed document so the semantic filter
// (with a low similarity_threshold) does not exclude valid intersection members.
const BROAD_QUERY = 'engineering product notes API version release documentation roadmap features architecture';
// ---------------------------------------------------------------------------
// Logging (stderr only, never stdout)
// ---------------------------------------------------------------------------
function log(...args) {
    process.stderr.write(args.map(String).join(' ') + '\n');
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Read the run-id used to keep parallel runs isolated. */
function readRunId() {
    const runIdFile = process.env.RUN_ID_FILE || '/logs/artifacts/run-id';
    try {
        const raw = fs.readFileSync(runIdFile, 'utf8');
        const trimmed = raw.trim();
        if (trimmed) {
            return trimmed;
        }
    }
    catch (err) {
        log(`[warn] could not read run-id file ${runIdFile}: ${err.message}`);
    }
    // Fallbacks
    if (process.env.RUN_ID) {
        return process.env.RUN_ID.trim();
    }
    const fallback = `run-${Date.now()}`;
    log(`[warn] no run-id found; generated fallback run-id: ${fallback}`);
    return fallback;
}
/** Parse `--groups eng v1` from argv. */
function parseGroups(argv) {
    const idx = argv.indexOf('--groups');
    if (idx === -1) {
        throw new Error("Missing required '--groups' argument. Example: node dist/main.js --groups eng v1");
    }
    const groups = argv.slice(idx + 1).filter((g) => g.length > 0);
    if (groups.length === 0) {
        throw new Error("'--groups' must be followed by at least one group. Example: --groups eng v1");
    }
    return groups;
}
/**
 * Determine which seed keys SHOULD match given a set of requested groups, using
 * intersection semantics (a seed doc matches iff its groups are a superset of the
 * requested groups). This is used only to decide whether a retry is worthwhile.
 */
function expectedKeysFor(groups) {
    const requested = new Set(groups);
    const expected = new Set();
    for (const doc of SEED_CORPUS) {
        const docGroups = new Set(doc.groups);
        let isSuperset = true;
        for (const g of requested) {
            if (!docGroups.has(g)) {
                isSuperset = false;
                break;
            }
        }
        if (isSuperset) {
            expected.add(doc.key);
        }
    }
    return expected;
}
/**
 * Map a returned context chunk back to one of the seed keys by scanning both the
 * chunk content and its (stringified) metadata for a literal key token.
 */
function extractKey(context) {
    const haystack = [context.content || '', JSON.stringify(context.metadata ?? {})].join('\n');
    for (const key of ALL_KEYS) {
        if (haystack.includes(key)) {
            return key;
        }
    }
    return null;
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    // 1. Parse CLI args.
    const groups = parseGroups(process.argv.slice(2));
    log(`[info] requested groups (intersection): ${JSON.stringify(groups)}`);
    // 2. Read run-id for stable, isolated file_names.
    const runId = readRunId();
    log(`[info] run-id: ${runId}`);
    // 3. Initialize the Alchemyst client.
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey) {
        throw new Error('ALCHEMYST_AI_API_KEY environment variable is not set');
    }
    const client = new sdk_1.default({ apiKey });
    // 4. Ingest the seed corpus, handling existing documents safely (rerunnable).
    log('[info] ingesting seed corpus...');
    for (const doc of SEED_CORPUS) {
        const fileName = `${doc.key}-${runId}.md`;
        // Delete any pre-existing document with this file_name first (ignore errors
        // if it does not exist) so re-runs do not hit 409 Conflict. The delete
        // endpoint requires a top-level `source` string and a `metadata` object with
        // the camelCase `fileName` identifier.
        try {
            await client.v1.context.delete({
                source: 'documentation',
                metadata: { fileName },
            });
            log(`[info] deleted pre-existing ${fileName}`);
        }
        catch (err) {
            // Non-fatal: the document may simply not exist yet.
            log(`[debug] pre-delete for ${fileName} skipped: ${err.message ?? err}`);
        }
        // Add the document. This SDK version requires a top-level `metadata` object.
        // Storage uses snake_case `group_name` inside metadata (per the SDK quirk),
        // and the file identifier uses camelCase `fileName` (matching delete). We
        // also include snake_case `file_name` for compatibility with the docs.
        try {
            await client.v1.context.add({
                documents: [
                    {
                        content: doc.content,
                    },
                ],
                metadata: {
                    fileName,
                    file_name: fileName,
                    group_name: doc.groups,
                },
                context_type: 'resource',
                source: 'documentation',
                scope: 'internal',
            });
            log(`[info] ingested ${fileName} (groups: ${JSON.stringify(doc.groups)})`);
        }
        catch (err) {
            if (err instanceof sdk_2.ConflictError || err?.status === 409) {
                // Tolerate a 409 if a concurrent run added the same file_name.
                log(`[info] ${fileName} already exists (409 tolerated)`);
            }
            else {
                throw err;
            }
        }
    }
    // Give the context processor a brief moment to finish indexing.
    log('[info] allowing index to settle...');
    await sleep(2000);
    // 5. Context Arithmetic intersection search.
    //    The TypeScript SDK search form uses camelCase `groupName`.
    const searchParams = {
        query: BROAD_QUERY,
        // A low similarity_threshold so the semantic filter does not exclude valid
        // intersection members. minimum_similarity_threshold is the lower bound and
        // must be <= similarity_threshold.
        similarity_threshold: 0.1,
        minimum_similarity_threshold: 0,
        scope: 'internal',
        metadata: {
            groupName: groups,
        },
    };
    log(`[info] searching with metadata.groupName = ${JSON.stringify(groups)}`);
    let contexts = [];
    const expected = expectedKeysFor(groups);
    // Retry once if the index was not yet ready and we expected non-empty results.
    for (let attempt = 1; attempt <= 2; attempt++) {
        const response = (await client.v1.context.search(searchParams));
        contexts = response.contexts ?? [];
        log(`[info] search attempt ${attempt}: returned ${contexts.length} context chunk(s)`);
        const found = new Set();
        for (const ctx of contexts) {
            const key = extractKey(ctx);
            if (key)
                found.add(key);
        }
        if (expected.size === 0) {
            // Empty intersection is a valid result; no retry needed.
            break;
        }
        // If we already found every expected key, we're done.
        let allFound = true;
        for (const k of expected) {
            if (!found.has(k)) {
                allFound = false;
                break;
            }
        }
        if (allFound || attempt === 2) {
            break;
        }
        log('[info] not all expected keys found yet; retrying after short delay...');
        await sleep(2000);
    }
    // 6. Map contexts -> result docs, deduplicated by key.
    const byKey = new Map();
    for (const ctx of contexts) {
        const key = extractKey(ctx);
        if (!key) {
            log(`[debug] skipping unmappable context chunk: ${(ctx.content || '').slice(0, 80)}...`);
            continue;
        }
        if (byKey.has(key)) {
            continue; // deduplicate by key
        }
        const meta = (ctx.metadata ?? {});
        byKey.set(key, {
            key,
            content: ctx.content,
            file_name: meta.file_name ?? meta.fileName ?? undefined,
            score: ctx.score,
        });
    }
    // Preserve a stable, deterministic order (seed corpus order).
    const results = [];
    for (const doc of SEED_CORPUS) {
        if (byKey.has(doc.key)) {
            results.push(byKey.get(doc.key));
        }
    }
    // 7. Print exactly one JSON array to stdout.
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
}
main().catch((err) => {
    log(`[error] ${err?.stack ?? err?.message ?? err}`);
    process.exit(1);
});
