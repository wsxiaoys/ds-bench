import AlchemystAI from "@alchemystai/sdk";

// ── CLI Argument Parsing ─────────────────────────────────────────────────────
interface ParsedArgs {
  userId?: string;
  addContent?: string;
  queryContent?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--user-id" && argv[i + 1]) {
      result.userId = argv[++i];
    } else if (argv[i] === "--add" && argv[i + 1]) {
      result.addContent = argv[++i];
    } else if (argv[i] === "--query" && argv[i + 1]) {
      result.queryContent = argv[++i];
    }
  }
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // Validate --user-id is present
  if (!args.userId) {
    console.error("MISSING_PARAMETERS: --user-id is required");
    process.exit(1);
  }

  // Validate exactly one of --add or --query
  if (!args.addContent && !args.queryContent) {
    console.error(
      "MISSING_PARAMETERS: either --add or --query is required"
    );
    process.exit(1);
  }

  if (args.addContent && args.queryContent) {
    console.error(
      "MISSING_PARAMETERS: cannot specify both --add and --query"
    );
    process.exit(1);
  }

  // Validate required environment variables
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error(
      "MISSING_PARAMETERS: ALCHEMYST_AI_API_KEY environment variable is required"
    );
    process.exit(1);
  }

  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    console.error(
      "MISSING_PARAMETERS: ZEALT_RUN_ID environment variable is required"
    );
    process.exit(1);
  }

  // Derive shared sessionId from ZEALT_RUN_ID to avoid cross-run collisions
  const sessionId = `team-standup-${runId}`;

  const client = new AlchemystAI({ apiKey });

  if (args.addContent) {
    // ── Store a new memory ──────────────────────────────────────────────────
    await client.v1.context.memory.add({
      userId: args.userId,
      sessionId: sessionId,
      content: args.addContent,
    });
    console.log(`ADDED: ${args.addContent}`);
  } else if (args.queryContent) {
    // ── Search shared memory ───────────────────────────────────────────────
    const result = await client.v1.context.memory.search({
      userId: args.userId,
      sessionId: sessionId,
      query: args.queryContent,
      minimum_similarity_threshold: 0.1,
      similarity_threshold: 0.3,
    });

    if (result.memories && result.memories.length > 0) {
      for (const memory of result.memories) {
        const content =
          typeof memory === "object" && memory !== null && "content" in memory
            ? (memory as { content: string }).content
            : String(memory);
        console.log(`MEMORY: ${content}`);
      }
    }
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});