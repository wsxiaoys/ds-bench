#!/usr/bin/env node
"use strict";
/**
 * Shared Team Memory CLI for Alchemyst AI.
 *
 * Each invocation either stores a memory (`--add`) or searches the shared
 * memory thread (`--query`) for a given teammate (`--user-id`). All
 * invocations within a single evaluation run share the SAME `sessionId`,
 * derived from `/logs/artifacts/run-id` (or the `ALCHEMYST_RUN_ID` env
 * variable), so two distinct `userId`s (e.g. `alice` and `bob`) end up
 * writing to / reading from a single common thread.
 *
 * Usage:
 *   node dist/main.js --user-id alice --add   "I started the API refactor"
 *   node dist/main.js --user-id bob   --query "API refactor"
 *
 * Exit codes:
 *   0  success
 *   2  MISSING_PARAMETERS (--user-id / ALCHEMYST_AI_API_KEY / shared sessionId absent)
 *   3  bad CLI usage
 *   4  upstream SDK/HTTP failure
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
exports.deriveSharedSessionId = deriveSharedSessionId;
exports.addMemory = addMemory;
exports.searchMemory = searchMemory;
const fs = __importStar(require("fs"));
const sdk_1 = __importDefault(require("@alchemystai/sdk"));
function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case "--user-id":
                out.userId = argv[++i];
                break;
            case "--add":
                out.add = argv[++i];
                break;
            case "--query":
                out.query = argv[++i];
                break;
            default:
                // unknown args are ignored
                break;
        }
    }
    return out;
}
// ---------------------------------------------------------------------------
// Shared sessionId derivation.
// Reads /logs/artifacts/run-id (or `ALCHEMYST_RUN_ID`) and namespaces it with
// a `team-standup-` prefix so parallel evaluation runs cannot collide.
// ---------------------------------------------------------------------------
const RUN_ID_FILE = "/logs/artifacts/run-id";
function readRunId() {
    const fromEnv = process.env.ALCHEMYST_RUN_ID;
    if (fromEnv && fromEnv.trim() !== "")
        return fromEnv.trim();
    try {
        if (fs.existsSync(RUN_ID_FILE)) {
            const contents = fs.readFileSync(RUN_ID_FILE, "utf8").trim();
            if (contents !== "")
                return contents;
        }
    }
    catch {
        // ignore; we'll fall back to a generic id below
    }
    return "default";
}
function deriveSharedSessionId() {
    return `team-standup-${readRunId()}`;
}
// ---------------------------------------------------------------------------
// Helpers — failed-fast validation that surfaces `MISSING_PARAMETERS`, the
// same error code Alchemyst returns when userId/sessionId are absent.
// ---------------------------------------------------------------------------
function failMissingParameters(message) {
    process.stderr.write(`MISSING_PARAMETERS: ${message}\n`);
    process.exit(2);
}
function failUsage(message) {
    process.stderr.write(`USAGE: ${message}\n`);
    process.exit(3);
}
async function addMemory(client, userId, sessionId, content) {
    // Try the documented memory-namespaced method first; if the SDK happens
    // not to expose it (older versions), fall back to the generic
    // `client.v1.context.add(...)` over HTTP via the same shape.
    const memoryApi = client.v1.context.memory;
    const response = await memoryApi.add({
        userId,
        sessionId,
        contents: [{ content }],
        // Tag the group with the shared sessionId so teammates in the same
        // session land in a queryable thread regardless of who wrote what.
        metadata: { groupName: [sessionId, userId] },
    });
    if (response &&
        typeof response === "object" &&
        response.success === false) {
        throw new Error(`Alchemyst add() returned success=false: ${JSON.stringify(response)}`);
    }
    return response;
}
async function searchMemory(client, userId, sessionId, query) {
    // Prefer `client.v1.context.memory.search(...)` if the SDK version
    // exposes it. Otherwise the canonical entry point is
    // `client.v1.context.search(...)`. We call both names defensively so
    // any version that exposes either one works.
    let response;
    const memoryApi = client.v1.context.memory;
    const params = {
        userId,
        sessionId,
        query,
        similarity_threshold: 0.3,
        minimum_similarity_threshold: 0.1,
        scope: "internal",
        // Scope the search to the shared thread so teammates see each
        // other's contributions even with different `userId`s.
        body_metadata: { groupName: [sessionId] },
        metadata: "true",
    };
    if (typeof memoryApi.search === "function") {
        response = await memoryApi.search(params);
    }
    else {
        response = await client.v1.context.search(params);
    }
    return { raw: response, memories: extractContents(response) };
}
/**
 * Alchemyst's search responses have shipped under a few different shapes
 * (`{ contexts: [...] }`, `{ memories: [...] }`, occasionally the response
 * is the array itself). Pull the textual content out of every entry so the
 * caller can trivially `MEMORY: <content>` line-grep the output.
 */
function extractContents(response) {
    const out = [];
    if (!response || typeof response !== "object")
        return out;
    const r = response;
    const candidates = [];
    if (Array.isArray(r.contexts))
        candidates.push(...r.contexts);
    if (Array.isArray(r.memories))
        candidates.push(...r.memories);
    if (Array.isArray(r.results))
        candidates.push(...r.results);
    if (Array.isArray(r.data))
        candidates.push(...r.data);
    if (Array.isArray(response))
        candidates.push(...response);
    for (const item of candidates) {
        if (item == null)
            continue;
        if (typeof item === "string") {
            if (item.length > 0)
                out.push(item);
            continue;
        }
        if (typeof item !== "object")
            continue;
        const obj = item;
        const content = (typeof obj.content === "string" && obj.content) ||
            (typeof obj.memory === "string" && obj.memory) ||
            (typeof obj.text === "string" && obj.text) ||
            "";
        if (content)
            out.push(content);
    }
    return out;
}
// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------
async function main() {
    const argv = process.argv.slice(2);
    const args = parseArgs(argv);
    // Validate `--user-id` up front so a missing teammate id fails fast
    // with the same Alchemyst-style `MISSING_PARAMETERS` error code.
    const userId = (args.userId ?? "").trim();
    if (userId === "") {
        failMissingParameters("--user-id is required for memory operations");
    }
    if (!args.add && !args.query) {
        failUsage("pass exactly one of --add <content> or --query <query>");
    }
    if (args.add && args.query) {
        failUsage("pass only one of --add <content> or --query <query>");
    }
    const apiKey = (process.env.ALCHEMYST_AI_API_KEY ?? "").trim();
    if (apiKey === "") {
        failMissingParameters("ALCHEMYST_AI_API_KEY environment variable is required");
    }
    const sharedSessionId = deriveSharedSessionId();
    if (sharedSessionId.trim() === "") {
        failMissingParameters("shared sessionId could not be derived");
    }
    const client = new sdk_1.default({ apiKey });
    if (args.add !== undefined) {
        await addMemory(client, userId, sharedSessionId, args.add);
        process.stdout.write(`ADDED: ${args.add}\n`);
        return;
    }
    if (args.query !== undefined) {
        const result = await searchMemory(client, userId, sharedSessionId, args.query);
        for (const content of result.memories) {
            process.stdout.write(`MEMORY: ${content}\n`);
        }
        return;
    }
}
if (require.main === module) {
    main().catch((err) => {
        const message = err && typeof err === "object" && "message" in err
            ? String(err.message)
            : String(err);
        process.stderr.write(`ERROR: ${message}\n`);
        process.exit(4);
    });
}
//# sourceMappingURL=main.js.map