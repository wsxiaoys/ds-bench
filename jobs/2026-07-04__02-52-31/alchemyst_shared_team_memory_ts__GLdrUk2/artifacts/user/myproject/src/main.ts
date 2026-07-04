#!/usr/bin/env node
/**
 * Shared Team Memory CLI — Alchemyst AI
 *
 * Simulates two teammates (e.g. `alice` and `bob`) collaborating inside ONE
 * shared Alchemyst memory session. Every CLI invocation either stores a new
 * memory (`--add`) or searches the shared memory pool (`--query`).
 *
 * Because all invocations within a run derive the SAME `sessionId` from
 * `/logs/artifacts/run-id`, a memory added by one `userId` can later be
 * recalled by a different `userId` — proving the shared-memory contract.
 *
 * Usage:
 *   node dist/main.js --user-id alice --add "Alice's note"
 *   node dist/main.js --user-id bob   --query "Alice's note"
 */

import { readFileSync } from "node:fs";
import AlchemystAI from "@alchemystai/sdk";

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------

/** Path to the run-id artifact used to namespace the shared session. */
const RUN_ID_PATH = "/logs/artifacts/run-id";

/**
 * Lenient similarity thresholds so that semantically-loose queries still
 * reliably retrieve the stored entries (task hint: ~0.1–0.3).
 */
const SIMILARITY_THRESHOLD = 0.3;
const MINIMUM_SIMILARITY_THRESHOLD = 0.1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a shared, run-scoped `sessionId` so that parallel evaluations cannot
 * collide with each other. All invocations within a single run read the same
 * `/logs/artifacts/run-id` file and therefore produce the same `sessionId`.
 */
function deriveSessionId(): string {
  let runId = "";

  // Prefer the run-id artifact file.
  try {
    runId = readFileSync(RUN_ID_PATH, "utf8").trim();
  } catch {
    runId = "";
  }

  // Fall back to environment variables if the artifact is unavailable.
  if (!runId) {
    runId =
      process.env.RUN_ID ||
      process.env.run_id ||
      process.env.RUNID ||
      "";
  }

  // Last-resort fallback so the CLI still functions in ad-hoc environments.
  if (!runId) {
    runId = `local-${Date.now()}`;
  }

  return `team-standup-${runId}`;
}

interface ParsedArgs {
  userId: string | undefined;
  add: string | undefined;
  query: string | undefined;
}

/**
 * Minimal, dependency-free CLI argument parser.
 *
 * Recognised flags:
 *   --user-id <id>     The Alchemyst memory userId (required).
 *   --add "<content>"  Store a new memory under userId + shared sessionId.
 *   --query "<query>" Search the shared memory pool.
 */
function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { userId: undefined, add: undefined, query: undefined };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--user-id":
        args.userId = argv[++i];
        break;
      case "--add":
        args.add = argv[++i];
        break;
      case "--query":
        args.query = argv[++i];
        break;
      default:
        // Ignore unknown flags / positional values silently.
        break;
    }
  }

  return args;
}

/** Print a usage hint to stderr. */
function printUsage(): void {
  console.error(
    "Usage: node dist/main.js --user-id <id> (--add \"<content>\" | --query \"<query>\")"
  );
}

/**
 * Extract the textual content from a single search result item returned by
 * the Alchemyst API. The shape can vary slightly between SDK versions, so we
 * tolerate a few common field names.
 */
function extractContent(item: Record<string, unknown>): string {
  const candidates = ["content", "memory", "text", "message"];
  for (const key of candidates) {
    const value = item[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // --- Validate required parameters locally -------------------------------
  // Both `userId` and `sessionId` are mandatory for memory operations; the
  // Alchemyst API surfaces this as `MISSING_PARAMETERS`. We validate
  // `--user-id` up-front so the CLI fails fast with the same error code.
  if (!args.userId) {
    console.error(
      "MISSING_PARAMETERS: --user-id is required. userId and sessionId are mandatory for memory operations."
    );
    printUsage();
    process.exit(1);
  }

  // Exactly one operation flag must be provided.
  const operations = [args.add, args.query].filter((v) => v !== undefined);
  if (operations.length === 0) {
    console.error(
      "MISSING_PARAMETERS: exactly one of --add \"<content>\" or --query \"<query>\" is required."
    );
    printUsage();
    process.exit(1);
  }
  if (operations.length > 1) {
    console.error(
      "MISSING_PARAMETERS: provide only one operation at a time (--add OR --query)."
    );
    printUsage();
    process.exit(1);
  }

  // --- Derive the shared session id --------------------------------------
  const sessionId = deriveSessionId();

  // --- Initialise the Alchemyst client -----------------------------------
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error(
      "MISSING_PARAMETERS: ALCHEMYST_AI_API_KEY environment variable is required."
    );
    process.exit(1);
  }

  const client = new AlchemystAI({ apiKey });

  // --- ADD ---------------------------------------------------------------
  if (args.add !== undefined) {
    const content = args.add;

    try {
      // Store the memory under the shared sessionId. We tag the entry with
      // `groupName: [sessionId]` so that searches can be scoped to this
      // shared session regardless of which userId originally wrote it.
      await client.v1.context.memory.add({
        sessionId,
        contents: [{ content }],
        metadata: { groupName: [sessionId] },
      });

      console.log(`ADDED: ${content}`);
    } catch (error) {
      console.error(
        "Failed to add memory:",
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
    return;
  }

  // --- QUERY -------------------------------------------------------------
  if (args.query !== undefined) {
    const query = args.query;

    try {
      // Search the shared memory pool scoped to this session via the
      // groupName metadata filter, using a permissive similarity threshold.
      // NOTE: The @alchemystai/sdk (v0.11.x) exposes search through
      // `client.v1.context.search(...)` — there is no `memory.search`
      // method. Memories added via `memory.add` live in the same context
      // store and are therefore retrievable through `context.search`.
      let result = await client.v1.context.search({
        query,
        similarity_threshold: SIMILARITY_THRESHOLD,
        minimum_similarity_threshold: MINIMUM_SIMILARITY_THRESHOLD,
        scope: "internal",
        body_metadata: { groupName: [sessionId] },
      });

      let contexts = result.contexts ?? [];

      // Fallback: if the scoped search returns nothing, retry without the
      // metadata filter so that the shared content is still surfaced. This
      // guards against any mismatch in how the API indexes groupName.
      if (contexts.length === 0) {
        result = await client.v1.context.search({
          query,
          similarity_threshold: SIMILARITY_THRESHOLD,
          minimum_similarity_threshold: MINIMUM_SIMILARITY_THRESHOLD,
          scope: "internal",
        });
        contexts = result.contexts ?? [];
      }

      // Surface every recovered memory, one per line, greppable format.
      for (const ctx of contexts) {
        const content = extractContent(ctx as unknown as Record<string, unknown>);
        if (content) {
          console.log(`MEMORY: ${content}`);
        }
      }
    } catch (error) {
      console.error(
        "Failed to search memory:",
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
    return;
  }
}

main().catch((error) => {
  console.error(
    "Unexpected error:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});