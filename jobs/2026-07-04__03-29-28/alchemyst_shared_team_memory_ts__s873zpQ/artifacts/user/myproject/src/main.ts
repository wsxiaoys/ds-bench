#!/usr/bin/env node
/**
 * Shared Team Memory CLI for Alchemyst AI.
 *
 * Simulates two teammates ("alice" and "bob") collaborating in one shared
 * Alchemyst AI memory session. Each invocation either stores a new memory
 * (`--add`) or searches the shared memory pool (`--query`).
 *
 * - Both teammates derive the SAME `sessionId` from the per-run
 *   `/logs/artifacts/run-id` file (with a `team-standup-` namespace prefix)
 *   so that any contributor's entries are visible to the others via search.
 * - All Alchemyst calls go through the official `@alchemystai/sdk`.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import AlchemystAI from "@alchemystai/sdk";

// ---------------------------------------------------------------------------
// Shared session derivation
// ---------------------------------------------------------------------------

const RUN_ID_PATH = "/logs/artifacts/run-id";
const SESSION_PREFIX = "team-standup-";

function readRunId(): string {
  try {
    const raw = fs.readFileSync(RUN_ID_PATH, "utf8").trim();
    if (raw.length === 0) {
      throw new Error(`run-id file at ${RUN_ID_PATH} is empty`);
    }
    return raw;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to read run-id from ${RUN_ID_PATH}: ${reason}. ` +
        `Cannot derive a collision-free shared sessionId.`,
    );
  }
}

/**
 * Build the shared sessionId used by every invocation within a single run.
 * Namespaced with `team-standup-` so parallel evaluation runs cannot collide.
 */
function buildSharedSessionId(): string {
  const runId = readRunId();
  return `${SESSION_PREFIX}${runId}`;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  userId: string | undefined;
  add: string | undefined;
  query: string | undefined;
}

function printUsage(): void {
  const usage = [
    "Shared Team Memory CLI (Alchemyst AI)",
    "",
    "Usage:",
    "  node dist/main.js --user-id <id> (--add <content> | --query <query>)",
    "",
    "Required:",
    "  --user-id <id>     Identity of the teammate (alice, bob, ...).",
    "",
    "Operations (exactly one):",
    '  --add   "<content>"   Store a new memory in the shared session.',
    '  --query "<query>"     Search the shared memory pool and print matches.',
    "",
    "Environment:",
    "  ALCHEMYST_AI_API_KEY  Alchemyst AI API key (required).",
    `  ${RUN_ID_PATH}        File with the per-run id (used to derive sessionId).`,
    "",
  ].join("\n");
  process.stderr.write(usage + "\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    userId: undefined,
    add: undefined,
    query: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === "--user-id") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        throw new Error("--user-id requires a value");
      }
      parsed.userId = next;
      i++;
    } else if (token === "--add") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error("--add requires a value");
      }
      parsed.add = next;
      i++;
    } else if (token === "--query") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error("--query requires a value");
      }
      parsed.query = next;
      i++;
    } else if (token === "-h" || token === "--help") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Missing-parameters guard (mirrors Alchemyst's MISSING_PARAMETERS error)
// ---------------------------------------------------------------------------

function failMissingParameters(message: string): never {
  // Surface the same error code Alchemyst returns when `userId` or
  // `sessionId` are absent so callers can detect both cases uniformly.
  const payload = {
    success: false,
    error: {
      code: "MISSING_PARAMETERS",
      message,
    },
  };
  process.stderr.write(JSON.stringify(payload) + "\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Alchemyst operations
// ---------------------------------------------------------------------------

function buildClient(): AlchemystAI {
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      "ALCHEMYST_AI_API_KEY environment variable is not set. " +
        "Set it before invoking the CLI.",
    );
  }
  return new AlchemystAI({ apiKey });
}

async function addMemory(
  client: AlchemystAI,
  userId: string,
  sessionId: string,
  content: string,
): Promise<void> {
  // The memory endpoint requires `sessionId`; `userId` is attached as
  // a top-level property of the content entry (the SDK's `Content`
  // interface is open via `[k: string]: unknown`) so the shared session
  // retains authorship information for every message.
  const response = await client.v1.context.memory.add({
    sessionId,
    contents: [
      {
        content,
        userId,
        metadata: { messageId: `${userId}-${Date.now()}` },
      },
    ],
  });
  if (!response.success) {
    throw new Error(
      `Alchemyst reported failure adding memory: ${JSON.stringify(response)}`,
    );
  }
}

async function searchMemory(
  client: AlchemystAI,
  userId: string,
  sessionId: string,
  query: string,
): Promise<string[]> {
  // Lenient similarity thresholds so semantically related entries are
  // reliably retrieved even when phrasing differs across teammates.
  const response = await client.v1.context.search({
    query,
    similarity_threshold: 0.3,
    minimum_similarity_threshold: 0.1,
    scope: "internal",
    body_metadata: {
      // Encode both the shared sessionId and the requester's userId as
      // group names so the platform namespaces results per team session
      // while still attributing authorship on the per-message metadata.
      groupName: [sessionId, userId],
    },
  });

  const contexts = response.contexts ?? [];
  const contents: string[] = [];
  for (const ctx of contexts) {
    if (ctx && typeof ctx.content === "string" && ctx.content.length > 0) {
      contents.push(ctx.content);
    }
  }
  return contents;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Argument error: ${message}\n\n`);
    printUsage();
    process.exit(2);
    return;
  }

  // --user-id is mandatory for any memory operation. Fail fast with the
  // same MISSING_PARAMETERS code Alchemyst itself would return.
  if (!parsed.userId || parsed.userId.trim().length === 0) {
    failMissingParameters(
      "Both userId and sessionId are mandatory for memory operations. " +
        "Re-run with --user-id <id>.",
    );
  }

  // Resolve the shared sessionId up-front. If this fails the platform
  // would also reject the call, so we surface MISSING_PARAMETERS to keep
  // a single, predictable error surface.
  let sessionId: string;
  try {
    sessionId = buildSharedSessionId();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    failMissingParameters(
      `Cannot derive sessionId for memory operations: ${reason}`,
    );
  }

  // Exactly one of --add or --query must be supplied.
  if (parsed.add !== undefined && parsed.query !== undefined) {
    process.stderr.write(
      "Argument error: --add and --query are mutually exclusive; supply exactly one.\n\n",
    );
    printUsage();
    process.exit(2);
    return;
  }
  if (parsed.add === undefined && parsed.query === undefined) {
    failMissingParameters(
      "Either --add or --query must be supplied alongside --user-id.",
    );
  }

  const userId = parsed.userId as string; // narrowed above
  const client = buildClient();

  if (parsed.add !== undefined) {
    await addMemory(client, userId, sessionId, parsed.add);
    process.stdout.write(`ADDED: ${parsed.add}\n`);
    return;
  }

  if (parsed.query !== undefined) {
    const memories = await searchMemory(
      client,
      userId,
      sessionId,
      parsed.query,
    );
    for (const content of memories) {
      process.stdout.write(`MEMORY: ${content}\n`);
    }
    return;
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  if (err instanceof Error && err.stack) {
    process.stderr.write(err.stack + "\n");
  }
  process.exit(1);
});