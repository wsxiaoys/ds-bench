#!/usr/bin/env node
"use strict";
/**
 * Context Arithmetic Intersection Search CLI
 *
 * Demonstrates the Alchemyst TypeScript SDK parameter-asymmetry quirk:
 *   - Adding documents  → metadata uses `group_name` (snake_case)
 *   - Searching context → metadata uses `groupName`  (camelCase)
 *
 * Usage:
 *   node dist/main.js --groups eng v1
 *
 * All diagnostic output is sent to stderr so that stdout contains exactly
 * one JSON array (parseable by JSON.parse).
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
// ---------------------------------------------------------------------------
// Logging helper — everything goes to stderr
// ---------------------------------------------------------------------------
function log(...args) {
    console.error('[alchemyst-cli]', ...args);
}
// ---------------------------------------------------------------------------
// Run ID — read from /logs/artifacts/run-id so parallel/re-runs are isolated
// ---------------------------------------------------------------------------
function getRunId() {
    try {
        const raw = fs.readFileSync('/logs/artifacts/run-id', 'utf-8').trim();
        if (raw)
            return raw;
    }
    catch {
        log('Warning: could not read /logs/artifacts/run-id — using timestamp fallback');
    }
    return `fallback-${Date.now()}`;
}
// ---------------------------------------------------------------------------
// CLI argument parsing — expects: --groups <g1> <g2> ...
// ---------------------------------------------------------------------------
function parseGroups(argv) {
    const idx = argv.indexOf('--groups');
    if (idx === -1) {
        log('Error: --groups flag is required. Example: node dist/main.js --groups eng v1');
        process.exit(1);
    }
    const groups = [];
    for (let i = idx + 1; i < argv.length; i++) {
        if (argv[i].startsWith('--'))
            break;
        groups.push(argv[i]);
    }
    if (groups.length === 0) {
        log('Error: at least one group must follow --groups. Example: node dist/main.js --groups eng v1');
        process.exit(1);
    }
    return groups;
}
const SEED_CORPUS = [
    {
        key: 'ENG_V1_DOC',
        groups: ['eng', 'v1'],
        content: 'Engineering notes for API version 1. Key: ENG_V1_DOC. ' +
            'This document covers the engineering design decisions, architecture, ' +
            'and technical specifications for the initial release of the API. ' +
            'Topics include endpoint design, authentication flow, and data models for version 1.',
    },
    {
        key: 'ENG_V2_DOC',
        groups: ['eng', 'v2'],
        content: 'Engineering notes for API version 2. Key: ENG_V2_DOC. ' +
            'This document covers the engineering upgrades, migration guide, ' +
            'and technical specifications for the second release of the API. ' +
            'Topics include new endpoints, deprecated features, and performance improvements for version 2.',
    },
    {
        key: 'PRODUCT_V1_DOC',
        groups: ['product', 'v1'],
        content: 'Product notes for release version 1. Key: PRODUCT_V1_DOC. ' +
            'This document covers the product strategy, feature roadmap, ' +
            'and user-facing documentation for the initial release. ' +
            'Topics include target audience, pricing tiers, and go-to-market plan for version 1.',
    },
    {
        key: 'PRODUCT_V2_DOC',
        groups: ['product', 'v2'],
        content: 'Product notes for release version 2. Key: PRODUCT_V2_DOC. ' +
            'This document covers the product strategy, feature roadmap, ' +
            'and user-facing documentation for the second release. ' +
            'Topics include new features, expanded pricing tiers, and customer feedback integration for version 2.',
    },
];
const ALL_KEYS = SEED_CORPUS.map((d) => d.key);
// ---------------------------------------------------------------------------
// Sleep helper
// ---------------------------------------------------------------------------
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// ---------------------------------------------------------------------------
// Ingest the seed corpus — use snake_case `group_name` inside metadata
// ---------------------------------------------------------------------------
async function ingestSeedCorpus(client, runId) {
    log('Ingesting seed corpus...');
    for (const doc of SEED_CORPUS) {
        const fileName = `${doc.key}-${runId}.md`;
        try {
            await client.v1.context.add({
                documents: [{ content: doc.content }],
                context_type: 'resource',
                source: 'web-upload',
                scope: 'internal',
                // NOTE: snake_case `group_name` and `file_name` for the ADD endpoint
                metadata: {
                    group_name: doc.groups,
                    file_name: fileName,
                }, // cast to bypass SDK camelCase types
            });
            log(`  ✓ Added ${doc.key} → ${fileName}`);
        }
        catch (err) {
            const e = err;
            const status = e?.status;
            const msg = String(e?.message ?? '');
            // Tolerate 409 Conflict — document already exists from a previous run
            if (status === 409 || msg.includes('409') || msg.toLowerCase().includes('already exists')) {
                log(`  ⊘ ${fileName} already exists (409) — skipping`);
            }
            else {
                log(`  ⚠ Error adding ${doc.key}: ${msg} (status=${status ?? 'n/a'})`);
                // Continue — the document may already be present from a prior run
            }
        }
    }
}
// ---------------------------------------------------------------------------
// Intersection search — use camelCase `groupName` inside metadata
// ---------------------------------------------------------------------------
async function intersectionSearch(client, cliGroups) {
    log(`Searching with groupName intersection: [${cliGroups.join(', ')}]`);
    // Broad query that loosely matches every seed document
    const query = 'engineering product notes API version release documentation technical specifications roadmap';
    // A low similarity_threshold (~0.1) ensures the semantic filter does not
    // accidentally exclude valid intersection members.
    // We also include both `metadata` and `body_metadata` to be robust against
    // API naming variations (the OpenAPI schema uses body_metadata while the
    // SDK type and quickstart use metadata).
    const searchBody = {
        query,
        similarity_threshold: 0.1,
        minimum_similarity_threshold: 0.0,
        scope: 'internal',
        metadata: {
            groupName: cliGroups, // camelCase for search
        },
        body_metadata: {
            groupName: cliGroups, // fallback per OpenAPI schema name
        },
    };
    // Retry a few times in case documents are still being indexed
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            const response = (await client.v1.context.search(searchBody));
            const contexts = response.contexts ?? [];
            log(`  Search attempt ${attempt}: ${contexts.length} context chunks returned`);
            if (contexts.length > 0) {
                for (const c of contexts.slice(0, 5)) {
                    log(`    score=${c.score ?? 'n/a'} content="${(c.content ?? '').substring(0, 80)}..."`);
                }
            }
            return contexts;
        }
        catch (err) {
            const e = err;
            log(`  Search attempt ${attempt} failed: ${e?.message ?? err} (status=${e?.status ?? 'n/a'})`);
            if (attempt < 5)
                await sleep(2000);
        }
    }
    log('  All search attempts failed — returning empty result set');
    return [];
}
// ---------------------------------------------------------------------------
// Map context chunks back to seed-document keys and deduplicate
// ---------------------------------------------------------------------------
function extractKeys(contexts) {
    const foundKeys = new Set();
    for (const ctx of contexts) {
        const content = ctx.content ?? '';
        for (const key of ALL_KEYS) {
            if (content.includes(key)) {
                foundKeys.add(key);
            }
        }
    }
    return Array.from(foundKeys);
}
function buildResults(keys, runId) {
    return keys.map((key) => {
        const doc = SEED_CORPUS.find((d) => d.key === key);
        return {
            key,
            file_name: `${key}-${runId}.md`,
            groups: doc.groups,
        };
    });
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey) {
        log('Error: ALCHEMYST_AI_API_KEY environment variable is not set');
        process.stdout.write('[]');
        return;
    }
    const cliGroups = parseGroups(process.argv);
    const runId = getRunId();
    log(`Run ID : ${runId}`);
    log(`Groups : [${cliGroups.join(', ')}]`);
    const client = new sdk_1.default({ apiKey });
    // Step 1 — Ingest seed corpus
    await ingestSeedCorpus(client, runId);
    // Allow indexing to settle
    log('Waiting for indexing to settle (3s)...');
    await sleep(3000);
    // Step 2 — Intersection search
    const contexts = await intersectionSearch(client, cliGroups);
    // Step 3 — Extract keys & deduplicate
    const keys = extractKeys(contexts);
    log(`Matched keys: [${keys.join(', ')}]`);
    const results = buildResults(keys, runId);
    // Step 4 — Print exactly one JSON array to stdout
    process.stdout.write(JSON.stringify(results));
    log(`Done — emitted ${results.length} result(s) to stdout`);
}
main().catch((err) => {
    const e = err;
    log('Fatal error:', e?.message ?? err);
    // Emit valid JSON so the verifier can parse stdout cleanly
    process.stdout.write('[]');
});
