"use strict";
/**
 * alchemyst-group-cli
 * ----------------------------------------------------------------------
 * Exercises the @alchemystai/sdk `group_name` (snake_case, on store) vs
 * `groupName` (camelCase, on search) asymmetry against the real Alchemyst
 * API.
 *
 *   • Seeds 4 idempotent resource documents (2 support, 2 engineering).
 *   • Each `file_name` is suffixed with the current run-id so concurrent
 *     runs do not collide.
 *   • Filters by group on search via `body_metadata.groupName`
 *     (SDK-typed name for the underlying body `metadata` field).
 *   • Prints a deduplicated, sorted JSON array of matching `file_name`s.
 *
 * Usage:
 *   ALCHEMYST_AI_API_KEY=... node dist/main.js --group support
 *   ALCHEMYST_AI_API_KEY=... node dist/main.js --group engineering
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const sdk_1 = __importStar(require("@alchemystai/sdk"));
function parseArgs(argv) {
    let group;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--group" || arg === "-g") {
            const next = argv[i + 1];
            if (!next || next.startsWith("--")) {
                throw new Error("--group requires a value (e.g. --group support)");
            }
            group = next;
            i++;
        }
        else if (arg.startsWith("--group=")) {
            group = arg.slice("--group=".length);
        }
    }
    if (!group) {
        throw new Error("Missing required argument: --group <name> (e.g. --group support)");
    }
    return { group };
}
// ---------------------------------------------------------------------------
// Env / run-id loading
// ---------------------------------------------------------------------------
function requireEnv(name) {
    const value = process.env[name];
    if (!value || value.trim().length === 0) {
        throw new Error(`Environment variable ${name} is required and must be non-empty.`);
    }
    return value;
}
function readRunId(path) {
    try {
        return (0, node_fs_1.readFileSync)(path, "utf8").trim();
    }
    catch (err) {
        throw new Error(`Could not read run-id from ${path}: ${err.message}`);
    }
}
const SUPPORT_TOPICS = [
    {
        title: "Refund Policy Runbook",
        body: "Customer support runbook for handling refund requests. " +
            "Approve refunds within 30 days of purchase, escalate disputes " +
            "to the support team lead, and always confirm the customer's " +
            "order id before issuing a refund.",
    },
    {
        title: "Support Escalation Playbook",
        body: "Support escalation procedures: tier-1 agents resolve billing " +
            "and account questions. Escalate legal or abuse reports to the " +
            "support security liaison within one business day.",
    },
];
const ENGINEERING_TOPICS = [
    {
        title: "Service Mesh Architecture",
        body: "Engineering architecture decision record for adopting a " +
            "sidecar-based service mesh across the production cluster. " +
            "Covers mTLS, traffic shifting, and the observability pipeline.",
    },
    {
        title: "On-Call Incident Response",
        body: "Engineering on-call playbook for production incident response. " +
            "Acknowledge pages within five minutes, open an incident channel, " +
            "and follow the blameless post-mortem template after mitigation.",
    },
];
function buildSeedDocs(runId) {
    const stamp = `-${runId}`;
    const docs = [];
    SUPPORT_TOPICS.forEach((t, idx) => {
        docs.push({
            fileName: `support-${slug(t.title)}-${idx}${stamp}.md`,
            groupName: "support",
            content: `# ${t.title}\n\n${t.body}\n\n(run-id: ${runId})`,
        });
    });
    ENGINEERING_TOPICS.forEach((t, idx) => {
        docs.push({
            fileName: `engineering-${slug(t.title)}-${idx}${stamp}.md`,
            groupName: "engineering",
            content: `# ${t.title}\n\n${t.body}\n\n(run-id: ${runId})`,
        });
    });
    return docs;
}
function slug(input) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
async function seedDocuments(client, docs) {
    // The Alchemyst `add` endpoint expects each document's metadata to use
    // snake_case keys (`file_name`, `group_name`). This is the store-side
    // half of the asymmetry the task is built around.
    //
    // The SDK's `Document` index signature is `[k: string]: string |
    // undefined`, which rejects nested objects at compile time. The wire
    // protocol accepts nested `metadata` per the docs, so we cast.
    const documents = docs.map((d) => ({
        content: d.content,
        metadata: {
            file_name: d.fileName,
            group_name: [d.groupName],
        },
    }));
    try {
        const result = await client.v1.context.add({
            documents,
            context_type: "resource",
            source: "docs",
            scope: "internal",
        });
        process.stderr.write(`[seed] add accepted (processed=${result.processed_documents ?? "?"})\n`);
    }
    catch (err) {
        if (err instanceof sdk_1.ConflictError) {
            // 409 → one or more file_names already exist. Idempotent seed:
            // treat as success and let the caller verify via search.
            process.stderr.write(`[seed] conflict on add (file_name already exists) — treating as already-seeded.\n`);
            return;
        }
        throw err;
    }
}
function extractFileNames(contexts) {
    if (!contexts || contexts.length === 0)
        return [];
    const seen = new Set();
    for (const ctx of contexts) {
        const meta = ctx.metadata;
        if (!meta || typeof meta !== "object")
            continue;
        const m = meta;
        const candidate = typeof m.file_name === "string"
            ? m.file_name
            : typeof m.fileName === "string"
                ? m.fileName
                : undefined;
        if (candidate)
            seen.add(candidate);
    }
    return Array.from(seen).sort();
}
async function searchByGroup(client, group) {
    // The search-side of the asymmetry: the filter key is camelCase
    // `groupName`, NOT snake_case `group_name`. The SDK exposes the
    // body metadata as `body_metadata` in its typed signature.
    const query = buildSearchQuery(group);
    const response = await client.v1.context.search({
        query,
        scope: "internal",
        similarity_threshold: 0.4,
        minimum_similarity_threshold: 0.0,
        metadata: "true", // ask the API to include metadata in each context
        body_metadata: {
            groupName: [group],
        },
    });
    return extractFileNames(response.contexts);
}
function buildSearchQuery(group) {
    // A short, group-specific query that should match the seeded docs well.
    const table = {
        support: "customer support runbook and escalation procedures",
        engineering: "engineering architecture on-call incident response",
    };
    return table[group] ?? `${group} team documentation and procedures`;
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const { group } = parseArgs(process.argv.slice(2));
    const apiKey = requireEnv("ALCHEMYST_AI_API_KEY");
    const runIdPath = (0, node_path_1.resolve)("/logs/artifacts/run-id");
    const runId = readRunId(runIdPath);
    const client = new sdk_1.default({ apiKey });
    const seedDocs = buildSeedDocs(runId);
    process.stderr.write(`[seed] run-id=${runId} seeding ${seedDocs.length} document(s)\n`);
    await seedDocuments(client, seedDocs);
    const fileNames = await searchByGroup(client, group);
    process.stdout.write(JSON.stringify(fileNames) + "\n");
}
main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[fatal] ${message}\n`);
    if (err instanceof Error && err.stack) {
        process.stderr.write(err.stack + "\n");
    }
    process.exit(1);
});
