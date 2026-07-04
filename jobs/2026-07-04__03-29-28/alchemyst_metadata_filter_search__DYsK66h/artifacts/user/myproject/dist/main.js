#!/usr/bin/env node
"use strict";
/**
 * Alchemyst AI CLI: seed four tagged documents, then run a metadata-filtered
 * context search that demonstrates the group_name (store) vs groupName (search)
 * asymmetry of the @alchemystai/sdk.
 *
 * Usage:
 *   node dist/main.js --group support
 *   node dist/main.js --group engineering
 *
 * Required env:
 *   ALCHEMYST_AI_API_KEY
 *
 * Required file:
 *   /logs/artifacts/run-id (used to namespace file_names per run)
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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("node:fs"));
const sdk_1 = __importStar(require("@alchemystai/sdk"));
const RUN_ID_PATH = "/logs/artifacts/run-id";
const SOURCE = "docs";
const SCOPE = "internal";
const CONTEXT_TYPE = "resource";
/** Read the run id from disk and trim any whitespace. */
function readRunId() {
    const raw = fs.readFileSync(RUN_ID_PATH, "utf8");
    const runId = raw.trim();
    if (!runId) {
        throw new Error(`Run id at ${RUN_ID_PATH} is empty`);
    }
    return runId;
}
/** Parse "--group <value>" out of argv. */
function parseGroupArg(argv) {
    const idx = argv.indexOf("--group");
    if (idx === -1 || idx === argv.length - 1) {
        throw new Error("Missing required --group <group_name> argument");
    }
    const group = argv[idx + 1];
    if (!group || group.startsWith("--")) {
        throw new Error("Missing value for --group <group_name>");
    }
    return group;
}
/** Build the four documents, suffixing each file_name with the run-id. */
function buildSeedDocuments(runId) {
    const supportDocs = [
        {
            content: `Run ${runId} - Support playbook: when a customer requests a refund, ` +
                `verify the order ID, confirm the 30-day window, and escalate to the ` +
                `billing queue.`,
            metadata: {
                file_name: `support-refund-playbook-${runId}.md`,
                group_name: ["support"],
            },
        },
        {
            content: `Run ${runId} - Support macro for password resets: ask for the ` +
                `registered email, send the one-time link, and confirm the user can ` +
                `log in within two minutes.`,
            metadata: {
                file_name: `support-password-reset-macro-${runId}.md`,
                group_name: ["support"],
            },
        },
    ];
    const engineeringDocs = [
        {
            content: `Run ${runId} - Engineering runbook: on a 5xx spike, page the on-call, ` +
                `freeze deploys, and roll back the most recent release if error rate ` +
                `exceeds 2 percent for five minutes.`,
            metadata: {
                file_name: `engineering-incident-runbook-${runId}.md`,
                group_name: ["engineering"],
            },
        },
        {
            content: `Run ${runId} - Engineering CI guide: every PR must pass lint, unit, ` +
                `and integration tests in GitHub Actions before review and must keep ` +
                `the main branch build green.`,
            metadata: {
                file_name: `engineering-ci-guide-${runId}.md`,
                group_name: ["engineering"],
            },
        },
    ];
    return [...supportDocs, ...engineeringDocs];
}
/** Add documents idempotently: a 409 conflict on a file_name is fine. */
async function seedDocuments(client, docs) {
    try {
        await client.v1.context.add({
            context_type: CONTEXT_TYPE,
            documents: docs,
            source: SOURCE,
            scope: SCOPE,
        });
        return;
    }
    catch (err) {
        if (err instanceof sdk_1.ConflictError) {
            // Already seeded in a prior run -- safe to ignore.
            return;
        }
        throw err;
    }
}
/**
 * Best-effort fallback: if the bulk add fails for any non-409 reason, try each
 * document individually so a single conflict (or transient error on one doc)
 * does not abort the whole seed pass.
 */
async function seedDocumentsIndividually(client, docs) {
    for (const doc of docs) {
        try {
            await client.v1.context.add({
                context_type: CONTEXT_TYPE,
                documents: [doc],
                source: SOURCE,
                scope: SCOPE,
            });
        }
        catch (err) {
            if (err instanceof sdk_1.ConflictError) {
                // Already seeded; treat as success.
                continue;
            }
            throw err;
        }
    }
}
/** Pull a string-valued `file_name` out of an opaque metadata blob. */
function extractFileName(metadata) {
    if (!metadata || typeof metadata !== "object")
        return undefined;
    const m = metadata;
    // Search result metadata may use either casing -- check both.
    const candidate = (typeof m.file_name === "string" && m.file_name) ||
        (typeof m.fileName === "string" && m.fileName);
    return typeof candidate === "string" ? candidate : undefined;
}
/** Run a filtered context search and return the unique file_names. */
async function searchGroup(client, group) {
    const response = await client.v1.context.search({
        query: `Find documents in the ${group} group that describe runbooks, guides, ` +
            `or policies.`,
        minimum_similarity_threshold: 0.0,
        similarity_threshold: 0.0,
        scope: SCOPE,
        metadata: "true",
        // NOTE: camelCase on search -- this is the asymmetry the task highlights.
        body_metadata: { groupName: [group] },
    });
    const contexts = response.contexts ?? [];
    const seen = new Set();
    const out = [];
    for (const ctx of contexts) {
        const fileName = extractFileName(ctx.metadata);
        if (fileName && !seen.has(fileName)) {
            seen.add(fileName);
            out.push(fileName);
        }
    }
    return out;
}
async function main() {
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey) {
        throw new Error("ALCHEMYST_AI_API_KEY environment variable is required");
    }
    const group = parseGroupArg(process.argv.slice(2));
    const runId = readRunId();
    const client = new sdk_1.default({ apiKey });
    const docs = buildSeedDocuments(runId);
    // Seed. Try bulk first; if the API rejects the batch payload (e.g. any
    // single 409 inside the array) fall back to per-document seeding so the
    // CLI is fully idempotent across re-runs.
    try {
        await seedDocuments(client, docs);
    }
    catch (bulkErr) {
        if (bulkErr instanceof sdk_1.ConflictError) {
            await seedDocumentsIndividually(client, docs);
        }
        else {
            throw bulkErr;
        }
    }
    const fileNames = await searchGroup(client, group);
    // Final contract: a single JSON array of file_name strings on stdout.
    process.stdout.write(JSON.stringify(fileNames) + "\n");
}
// Run main() but make sure unexpected errors land on stderr with a non-zero
// exit code so the CLI is script-friendly.
main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`alchemyst-cli: ${message}\n`);
    process.exit(1);
});
