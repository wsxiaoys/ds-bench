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
/**
 * Alchemyst AI Threshold Sensitivity CLI
 *
 * Usage:
 *   node dist/main.js --thresholds 0.5,0.7,0.9
 *
 * Demonstrates empirically how the `similarity_threshold` parameter for
 * `client.v1.context.search` affects the number of returned contexts.
 *
 * Environment:
 *   ALCHEMYST_AI_API_KEY  required; the API key for the Alchemyst tenant.
 */
const fs = __importStar(require("fs"));
const sdk_1 = __importDefault(require("@alchemystai/sdk"));
const sdk_2 = require("@alchemystai/sdk");
function parseArgs(argv) {
    let thresholdsRaw = null;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--thresholds') {
            const v = argv[i + 1];
            if (!v) {
                throw new Error('--thresholds requires a value');
            }
            thresholdsRaw = v;
            i++;
        }
        else if (a.startsWith('--thresholds=')) {
            thresholdsRaw = a.substring('--thresholds='.length);
        }
    }
    if (thresholdsRaw === null || thresholdsRaw.trim() === '') {
        throw new Error('Missing required argument: --thresholds <csv> (e.g. --thresholds 0.5,0.7,0.9)');
    }
    const thresholds = thresholdsRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => {
        const n = Number(s);
        if (!Number.isFinite(n)) {
            throw new Error(`Invalid threshold value: "${s}"`);
        }
        if (n < 0 || n > 1) {
            throw new Error(`Threshold out of range [0,1]: ${n}`);
        }
        return n;
    });
    if (thresholds.length === 0) {
        throw new Error('At least one threshold value is required');
    }
    return { thresholds };
}
// ---------------------------------------------------------------------------
// Run-id resolution
// ---------------------------------------------------------------------------
function readRunId() {
    const p = '/logs/artifacts/run-id';
    try {
        const raw = fs.readFileSync(p, 'utf8').trim();
        if (raw.length === 0) {
            throw new Error(`Run-id file ${p} is empty`);
        }
        // Sanitise: only keep alnum, dash, underscore so fileName is always safe.
        const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
        return safe;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to read run-id from ${p}: ${msg}`);
    }
}
function buildCorpus() {
    return [
        // Clearly on-topic (strong semantic match)
        {
            title: 'Cardiovascular benefits of regular aerobic exercise',
            content: 'Regular aerobic exercise such as running, swimming, or cycling strengthens the heart muscle, lowers resting heart rate, improves circulation, reduces blood pressure, and decreases the risk of coronary artery disease, heart attacks, and strokes. Medical guidelines recommend at least 150 minutes of moderate aerobic activity per week for cardiovascular health.',
        },
        {
            title: 'How exercise improves heart health and reduces disease risk',
            content: 'Engaging in regular physical activity improves cardiovascular health by lowering LDL cholesterol, raising HDL cholesterol, reducing arterial plaque buildup, and enhancing endothelial function. Studies show that people who exercise consistently have significantly lower rates of heart disease, hypertension, and stroke compared to sedentary individuals.',
        },
        {
            title: 'Exercise prescription for heart disease prevention',
            content: 'Cardiologists prescribe regular exercise as a frontline intervention to prevent heart disease. A balanced routine of cardio, strength training, and flexibility exercises supports long-term cardiovascular wellness, helps regulate blood sugar, and contributes to maintaining a healthy body weight, all of which protect the heart.',
        },
        {
            title: 'Long-term cardiovascular adaptations to exercise training',
            content: 'Long-term exercise training induces favorable cardiovascular adaptations including increased stroke volume, reduced resting heart rate, improved capillary density in skeletal muscle, lower systemic inflammation, and enhanced REDACTEDnomic balance, all of which translate into measurable reductions in cardiovascular mortality.',
        },
        // Tangentially related (share some keywords but are not directly on topic)
        {
            title: 'General fitness and wellness tips',
            content: 'Staying fit involves a mix of strength training, cardio, flexibility, and adequate sleep. Drinking water, eating whole foods, and managing stress also play important roles in overall wellness and longevity.',
        },
        {
            title: 'The role of diet in maintaining a healthy lifestyle',
            content: 'A balanced diet rich in fruits, vegetables, whole grains, lean proteins, and healthy fats supports overall health. Limiting processed foods and added sugars helps maintain energy, stable blood sugar, and a healthy weight.',
        },
        {
            title: 'Mental health benefits of physical activity',
            content: 'Regular physical activity has been shown to reduce symptoms of anxiety and depression, improve mood through endorphin release, enhance cognitive function, and contribute to better sleep quality, all of which support mental wellbeing.',
        },
        // Clearly off-topic (semantically distant)
        {
            title: 'Introduction to quantum computing',
            content: 'Quantum computing harnesses the principles of quantum mechanics such as superposition and entanglement to perform certain computations exponentially faster than classical computers. Qubits are the fundamental unit of quantum information.',
        },
        {
            title: 'A history of medieval European castles',
            content: 'Medieval European castles evolved from simple wooden motte-and-bailey structures to elaborate stone fortresses. They served defensive, administrative, and residential purposes for nobility throughout the Middle Ages.',
        },
        {
            title: 'Best practices for indoor orchid cultivation',
            content: 'Orchids thrive indoors with indirect sunlight, moderate humidity, and well-draining potting medium. Watering once a week and feeding with a diluted orchid fertilizer encourages healthy blooms year after year.',
        },
        {
            title: 'How to bake sourdough bread at home',
            content: 'Sourdough bread is made using a naturally leavened starter of flour and water. After a long, slow fermentation the dough is shaped and baked at high heat, producing a tangy flavor and an open, chewy crumb.',
        },
        {
            title: 'Fundamentals of machine learning model evaluation',
            content: 'Evaluating machine learning models involves metrics such as accuracy, precision, recall, F1-score, and AUC-ROC. Cross-validation, confusion matrices, and learning curves help diagnose overfitting, underfitting, and generalization error.',
        },
    ];
}
// ---------------------------------------------------------------------------
// Ingestion (idempotent)
// ---------------------------------------------------------------------------
async function ingestCorpus(client, runId) {
    const corpus = buildCorpus();
    const scope = 'internal';
    const source = `threshold-cli-${runId}`;
    const documents = corpus.map((d) => ({
        content: d.content,
        title: d.title,
    }));
    const lastModified = new Date().toISOString();
    for (let i = 0; i < documents.length; i++) {
        const fileName = `threshold_doc_${i}_${runId}.md`;
        const doc = documents[i];
        try {
            await client.v1.context.add({
                context_type: 'resource',
                documents: [
                    {
                        content: doc.content,
                        title: doc.title,
                    },
                ],
                scope,
                source,
                metadata: {
                    fileName,
                    fileSize: Buffer.byteLength(doc.content, 'utf8'),
                    fileType: 'text/markdown',
                    groupName: [`threshold-cli`, `run-${runId}`],
                    lastModified,
                },
            });
            // Stagger ingestion slightly to avoid rate-limit issues.
            await new Promise((r) => setTimeout(r, 250));
        }
        catch (err) {
            if (err instanceof sdk_2.ConflictError) {
                // Idempotency: 409 means the document is already stored for this run.
                process.stderr.write(`[ingest] 409 conflict on ${fileName}; treating as success (idempotent).\n`);
                continue;
            }
            // Some SDK errors may wrap the status; check shape defensively.
            const status = err && typeof err === 'object' && 'status' in err
                ? err.status
                : undefined;
            if (status === 409 || status === '409') {
                process.stderr.write(`[ingest] 409 conflict on ${fileName}; treating as success (idempotent).\n`);
                continue;
            }
            throw err;
        }
    }
}
// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
const QUERY = 'What are the benefits of regular exercise for cardiovascular health?';
const SCOPE = 'internal';
async function searchCount(client, threshold) {
    const res = await client.v1.context.search({
        query: QUERY,
        similarity_threshold: threshold,
        minimum_similarity_threshold: 0,
        scope: SCOPE,
    });
    const contexts = (res && res.contexts) || [];
    return Array.isArray(contexts) ? contexts.length : 0;
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const args = parseArgs(process.argv.slice(2));
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
        process.stderr.write('Error: ALCHEMYST_AI_API_KEY environment variable is not set.\n');
        process.exit(1);
    }
    const runId = readRunId();
    const client = new sdk_1.default({ apiKey });
    process.stderr.write(`[threshold-cli] run-id=${runId} thresholds=${args.thresholds.join(',')}\n`);
    // 1. Ingest the corpus (idempotent).
    await ingestCorpus(client, runId);
    // Small grace period for indexing before searching.
    await new Promise((r) => setTimeout(r, 1500));
    // 2. Search at each threshold and count contexts.
    const results = [];
    for (const t of args.thresholds) {
        let count = 0;
        try {
            count = await searchCount(client, t);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[threshold-cli] search failed at threshold=${t}: ${msg}\n`);
            throw err;
        }
        results.push({ threshold: t, count });
        process.stderr.write(`[threshold-cli] threshold=${t} count=${count}\n`);
    }
    const out = {
        query: QUERY,
        results,
    };
    process.stdout.write(JSON.stringify(out) + '\n');
}
main().catch((err) => {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    process.stderr.write(`[threshold-cli] fatal: ${msg}\n`);
    process.exit(1);
});
