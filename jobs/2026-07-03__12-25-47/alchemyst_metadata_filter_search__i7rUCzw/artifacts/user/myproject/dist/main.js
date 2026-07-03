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
    const args = { group: '' };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--group') {
            const v = argv[i + 1];
            if (!v)
                throw new Error('Missing value for --group');
            args.group = v;
            i++;
        }
        else if (a.startsWith('--group=')) {
            args.group = a.slice('--group='.length);
        }
    }
    if (!args.group) {
        throw new Error('Usage: node dist/main.js --group <group_name>');
    }
    return args;
}
function loadRunId(path) {
    if (!fs.existsSync(path)) {
        throw new Error(`Run id file not found: ${path}`);
    }
    return fs.readFileSync(path, 'utf8').trim();
}
function buildDocuments(runId) {
    return [
        {
            content: 'Support guide: how to reset a customer account password, including MFA recovery steps.',
            metadata: {
                file_name: `support-faq-password-${runId}.txt`,
                group_name: ['support'],
                file_type: 'text/plain',
            },
        },
        {
            content: 'Support guide: refund policy and how to issue partial refunds through the billing portal.',
            metadata: {
                file_name: `support-faq-refunds-${runId}.txt`,
                group_name: ['support'],
                file_type: 'text/plain',
            },
        },
        {
            content: 'Engineering runbook: deploying the search service to Kubernetes via the Helm chart in infra/charts/search.',
            metadata: {
                file_name: `engineering-deploy-search-${runId}.md`,
                group_name: ['engineering'],
                file_type: 'text/markdown',
            },
        },
        {
            content: 'Engineering postmortem: a brief investigation into an outage in the indexing pipeline on 2025-01-12.',
            metadata: {
                file_name: `engineering-postmortem-indexing-${runId}.md`,
                group_name: ['engineering'],
                file_type: 'text/markdown',
            },
        },
    ];
}
async function addDocumentsIdempotently(client, documents) {
    for (const doc of documents) {
        try {
            // Per the task description: store documents with client.v1.context.add,
            // putting file_name and group_name (snake_case) under each document's metadata.
            await client.v1.context.add({
                documents: [doc],
                context_type: 'resource',
                source: 'docs',
                scope: 'internal',
                metadata: doc.metadata,
            });
            // eslint-disable-next-line no-console
            console.error(`Seeded ${doc.metadata.file_name}`);
        }
        catch (err) {
            const status = err?.status ?? err?.statusCode ?? err?.response?.status;
            const message = err?.message ?? (typeof err === 'string' ? err : JSON.stringify(err));
            // Idempotency: tolerate 409 conflicts (duplicate file_name) so re-runs do not crash.
            if (status === 409 || /409|conflict|already/i.test(message)) {
                // eslint-disable-next-line no-console
                console.error(`Already exists, skipping: ${doc.metadata.file_name}`);
                continue;
            }
            throw err;
        }
    }
}
function pickString(value) {
    if (typeof value === 'string' && value.length > 0)
        return value;
    if (Array.isArray(value) && typeof value[0] === 'string')
        return value[0];
    return undefined;
}
async function searchByGroup(client, group) {
    // Note the documented asymmetry: search filters with `groupName` (camelCase).
    const resp = await client.v1.context.search({
        query: 'document',
        minimum_similarity_threshold: 0,
        similarity_threshold: 1,
        scope: 'internal',
        metadata: 'true',
        body_metadata: { groupName: [group] },
    });
    const contexts = Array.isArray(resp?.contexts) ? resp.contexts : [];
    const names = new Set();
    for (const c of contexts) {
        const md = c?.metadata;
        if (!md)
            continue;
        // The metadata may be stored under either case. Try both.
        const fileName = pickString(md.file_name) ??
            pickString(md.fileName) ??
            pickString(md['file-name']);
        if (fileName)
            names.add(fileName);
    }
    return Array.from(names);
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey) {
        throw new Error('ALCHEMYST_AI_API_KEY env var is required');
    }
    const runId = loadRunId('/logs/artifacts/run-id');
    const client = new sdk_1.default({ apiKey });
    const documents = buildDocuments(runId);
    await addDocumentsIdempotently(client, documents);
    const names = await searchByGroup(client, args.group);
    // Emit a single JSON array of strings on stdout.
    process.stdout.write(JSON.stringify(names) + '\n');
}
main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Error:', err && err.stack ? err.stack : err);
    process.exit(1);
});
