#!/usr/bin/env node
"use strict";
/**
 * Alchemyst AI Threshold Sensitivity CLI
 *
 * Demonstrates the effect of `similarity_threshold` on `v1.context.search`
 * by ingesting a small corpus with varied semantic relevance to a fixed query
 * and counting the returned contexts at each requested threshold.
 *
 * Usage:  node dist/main.js --thresholds 0.5,0.7,0.9
 *
 * Output: a single JSON object on stdout:
 *   { "query": "...", "results": [ { "threshold": 0.5, "count": N }, ... ] }
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = __importDefault(require("@alchemystai/sdk"));
const fs_1 = __importDefault(require("fs"));
/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */
// The fixed query used for every search.  Chosen so that the corpus spans
// a clear range of semantic relevance (on-topic -> tangential -> off-topic).
const FIXED_QUERY = "How do neural networks learn from training data using backpropagation and gradient descent?";
// The scope shared by both ingestion and search (must match).
const SCOPE = "internal";
// Path to the run-id artifact used to namespace file names across runs.
const RUN_ID_PATH = "/logs/artifacts/run-id";
// Upper bound for the similarity range.  We search the range
// [threshold, RANGE_MAX] so that a lower threshold yields a wider range
// and therefore more (or equal) results -- i.e. monotonically non-increasing
// counts as the threshold rises.
const RANGE_MAX = 1.0;
/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
/** Read the run-id from the artifacts directory. */
function readRunId() {
    try {
        const raw = fs_1.default.readFileSync(RUN_ID_PATH, "utf-8").trim();
        if (!raw) {
            throw new Error("run-id file is empty");
        }
        return raw;
    }
    catch (err) {
        console.error(`[error] Unable to read run-id from ${RUN_ID_PATH}: ${err.message}`);
        process.exit(1);
    }
}
/** Parse a comma-separated list of thresholds into validated numbers. */
function parseThresholds(csv) {
    if (!csv) {
        console.error("[error] --thresholds requires a comma-separated value list, e.g. 0.5,0.7,0.9");
        process.exit(2);
    }
    const parts = csv
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    if (parts.length === 0) {
        console.error("[error] --thresholds must contain at least one value");
        process.exit(2);
    }
    const values = [];
    for (const p of parts) {
        const v = Number(p);
        if (!Number.isFinite(v) || v < 0 || v > 1) {
            console.error(`[error] Invalid threshold "${p}". Each threshold must be a number in [0, 1].`);
            process.exit(2);
        }
        values.push(v);
    }
    return values;
}
/** Heuristic check for a 409 Conflict response from the SDK. */
function isConflictError(error) {
    const anyErr = error;
    if (!anyErr)
        return false;
    const status = anyErr.status ?? anyErr.statusCode ?? anyErr.code;
    if (status === 409 || status === "409")
        return true;
    const msg = String(anyErr.message ?? anyErr.error ?? anyErr.body ?? "");
    return /409|conflict/i.test(msg);
}
/** Heuristic check for a 429 rate-limit response. */
function isRateLimitError(error) {
    const anyErr = error;
    if (!anyErr)
        return false;
    const status = anyErr.status ?? anyErr.statusCode ?? anyErr.code;
    if (status === 429 || status === "429")
        return true;
    const msg = String(anyErr.message ?? anyErr.error ?? anyErr.body ?? "");
    return /429|rate.?limit/i.test(msg);
}
/** Sleep helper. */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/* ------------------------------------------------------------------ */
/* Corpus                                                              */
/* ------------------------------------------------------------------ */
/**
 * Build the corpus.  `fileName` includes the run-id so that concurrent runs
 * never collide and re-runs with the same run-id are idempotent.
 *
 * The corpus is deliberately spread across three relevance tiers relative to
 * FIXED_QUERY (which is about neural networks / backpropagation / gradient
 * descent):
 *   1. Clearly on-topic  -> very high similarity
 *   2. Tangentially related -> moderate similarity
 *   3. Clearly off-topic -> low similarity
 * This spread makes the threshold effect visible: a low threshold (0.5)
 * returns on-topic + tangential chunks, while a high threshold (0.9) returns
 * only the most relevant ones.
 */
function buildCorpus(runId) {
    const contents = [
        // --- Clearly on-topic (high similarity) ---
        "Backpropagation is the core algorithm used to train neural networks. " +
            "It works by computing the gradient of the loss function with respect to each " +
            "weight using the chain rule, then updating those weights via gradient descent. " +
            "This iterative process allows the network to learn from training data by " +
            "progressively reducing its prediction error across many epochs.",
        "Gradient descent is an optimization algorithm used to minimize the loss " +
            "function when training a neural network. By computing partial derivatives " +
            "through backpropagation, the network adjusts its parameters to learn patterns " +
            "from the training data. Stochastic gradient descent is a popular variant that " +
            "processes the data in small mini-batches for faster convergence.",
        "Training a deep neural network involves two alternating phases: forward " +
            "propagation, which computes predictions from the training data, and " +
            "backpropagation, which computes the gradients of the loss with respect to every " +
            "weight. An optimizer such as gradient descent then applies these gradients to " +
            "update the weights so that the model gradually learns to fit the data.",
        // --- Tangentially related (moderate similarity) ---
        "Machine learning models rely on optimization techniques to minimize a cost " +
            "function. While classical statistical methods sometimes admit closed-form " +
            "solutions, most modern approaches use iterative optimization. The choice of " +
            "optimizer and its hyperparameters strongly influences how quickly a model " +
            "converges and the quality of the final solution.",
        "Data preprocessing is a crucial step in any machine learning pipeline. " +
            "Normalizing input features, handling missing values, and splitting the data into " +
            "training and validation sets all help a learning algorithm generalize to unseen " +
            "examples. Feature engineering can also have a large impact on model performance.",
        // --- Clearly off-topic (low similarity) ---
        "The best chocolate chip cookie recipe starts with creaming together butter and " +
            "brown sugar, then beating in eggs and vanilla extract. Fold in the flour, baking " +
            "soda, and chocolate chips, then drop spoonfuls onto a baking sheet. Bake at 375 " +
            "degrees Fahrenheit for about ten to twelve minutes until the edges are golden.",
        "Paris is famous for the Eiffel Tower, the Louvre Museum, and Notre-Dame " +
            "Cathedral. Visitors can stroll along the Seine, sample French cuisine at sidewalk " +
            "bistros, and wander the cobbled streets of Montmartre. The city is also known for " +
            "itss fashion houses and vibrant cafe culture.",
        "Growing tomatoes requires full sun, well-drained soil, and consistent watering. " +
            "Stake or cage the plants to keep them upright and prune away suckers to direct " +
            "energy toward fruit production. Watch out for common pests such as aphids and " +
            "tomato hornworms throughout the growing season.",
    ];
    return contents.map((content, idx) => ({
        content,
        fileName: `threshold_doc_${idx}_${runId}.md`,
    }));
}
/* ------------------------------------------------------------------ */
/* Ingestion                                                           */
/* ------------------------------------------------------------------ */
/**
 * Ingest a single document idempotently.  A 409 Conflict (document with the
 * same fileName already exists) is treated as success so that re-running the
 * CLI with the same run-id never crashes.
 */
async function ingestOne(client, entry, attempt = 1) {
    try {
        await client.v1.context.add({
            documents: [{ content: entry.content, file_name: entry.fileName }],
            context_type: "resource",
            source: "documentation",
            scope: SCOPE,
            metadata: { fileName: entry.fileName },
        });
        console.error(`[ingest] stored ${entry.fileName}`);
    }
    catch (error) {
        if (isConflictError(error)) {
            console.error(`[ingest] ${entry.fileName} already exists (409) - skipping`);
            return;
        }
        if (isRateLimitError(error) && attempt < 4) {
            const wait = 5 * attempt;
            console.error(`[ingest] rate limited (429) on ${entry.fileName}, retrying in ${wait}s`);
            await sleep(wait * 1000);
            return ingestOne(client, entry, attempt + 1);
        }
        throw error;
    }
}
/** Ingest every document in the corpus, one at a time (idempotent). */
async function ingestCorpus(client, corpus) {
    for (const entry of corpus) {
        await ingestOne(client, entry);
    }
}
/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */
/**
 * Search the context store for chunks whose similarity to FIXED_QUERY falls
 * in the range [threshold, RANGE_MAX].  Because the lower bound rises with
 * the threshold, a higher threshold can only return the same number or fewer
 * contexts -- guaranteeing monotonically non-increasing counts.
 *
 * Retries on rate-limit (429) errors.
 */
async function searchCount(client, threshold, attempt = 1) {
    try {
        const result = await client.v1.context.search({
            query: FIXED_QUERY,
            minimum_similarity_threshold: threshold,
            similarity_threshold: RANGE_MAX,
            scope: SCOPE,
        });
        const contexts = result.contexts;
        const count = Array.isArray(contexts) ? contexts.length : 0;
        console.error(`[search] threshold=${threshold} -> ${count} contexts`);
        return count;
    }
    catch (error) {
        if (isRateLimitError(error) && attempt < 4) {
            const wait = 5 * attempt;
            console.error(`[search] rate limited (429) at threshold=${threshold}, retrying in ${wait}s`);
            await sleep(wait * 1000);
            return searchCount(client, threshold, attempt + 1);
        }
        throw error;
    }
}
/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
async function main() {
    // --- Validate API key --------------------------------------------------
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey) {
        console.error("[error] ALCHEMYST_AI_API_KEY environment variable is not set.");
        process.exit(1);
    }
    // --- Parse CLI arguments ----------------------------------------------
    const argv = process.argv.slice(2);
    let thresholdsCsv;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--thresholds") {
            thresholdsCsv = argv[i + 1];
            i++;
        }
        else if (arg.startsWith("--thresholds=")) {
            thresholdsCsv = arg.slice("--thresholds=".length);
        }
        else if (arg === "--help" || arg === "-h") {
            console.error("Usage: node dist/main.js --thresholds 0.5,0.7,0.9");
            process.exit(0);
        }
        else {
            console.error(`[error] Unknown argument: ${arg}`);
            process.exit(2);
        }
    }
    if (thresholdsCsv === undefined) {
        console.error("[error] --thresholds is required, e.g. --thresholds 0.5,0.7,0.9");
        process.exit(2);
    }
    const thresholds = parseThresholds(thresholdsCsv);
    // --- Read run-id -------------------------------------------------------
    const runId = readRunId();
    console.error(`[info] run-id = ${runId}`);
    // --- Initialize SDK ----------------------------------------------------
    const client = new sdk_1.default({ apiKey });
    // --- Build & ingest corpus --------------------------------------------
    const corpus = buildCorpus(runId);
    console.error(`[info] ingesting ${corpus.length} documents...`);
    await ingestCorpus(client, corpus);
    // Give the index a brief moment to settle before searching.
    console.error("[info] waiting briefly for indexing to settle...");
    await sleep(5000);
    // --- Search at each threshold -----------------------------------------
    const results = [];
    for (const threshold of thresholds) {
        const count = await searchCount(client, threshold);
        results.push({ threshold, count });
    }
    // --- Emit exactly one JSON object to stdout ---------------------------
    const output = {
        query: FIXED_QUERY,
        results,
    };
    process.stdout.write(JSON.stringify(output) + "\n");
}
main().catch((err) => {
    console.error("[fatal]", err instanceof Error ? err.stack || err.message : String(err));
    process.exit(1);
});
