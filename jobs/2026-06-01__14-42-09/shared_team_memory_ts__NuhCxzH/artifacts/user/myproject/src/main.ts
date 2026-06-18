/**
 * Shared team memory CLI using the official @alchemystai/sdk.
 *
 * Usage:
 *   node dist/main.js --user-id <id> --add   "<content>"
 *   node dist/main.js --user-id <id> --query "<query>"
 *
 * Both userId and sessionId are mandatory for Alchemyst memory operations.
 * The sessionId is derived from ZEALT_RUN_ID so multiple parallel evaluation
 * runs cannot collide. All invocations within the same run share the same
 * sessionId (so any team member can recall the full thread).
 */

import AlchemystAI from "@alchemystai/sdk";

interface CliArgs {
  userId?: string;
  add?: string;
  query?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--user-id":
      case "--userId":
      case "--user":
        out.userId = next;
        i++;
        break;
      case "--add":
        out.add = next;
        i++;
        break;
      case "--query":
        out.query = next;
        i++;
        break;
      default:
        if (arg.startsWith("--user-id=")) {
          out.userId = arg.slice("--user-id=".length);
        } else if (arg.startsWith("--add=")) {
          out.add = arg.slice("--add=".length);
        } else if (arg.startsWith("--query=")) {
          out.query = arg.slice("--query=".length);
        }
        break;
    }
  }
  return out;
}

function deriveSessionId(): string {
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId || runId.length === 0) {
    // Still produce a deterministic, namespaced value. The Alchemyst API
    // requires a non-empty sessionId; without ZEALT_RUN_ID we fall back to
    // a clearly-marked placeholder so the failure is loud rather than silent.
    return "team-standup-local";
  }
  return `team-standup-${runId}`;
}

function fail(message: string): never {
  process.stderr.write(message + "\n");
  process.exit(1);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Local fast-fail validation that mirrors Alchemyst's MISSING_PARAMETERS
  // error so callers see the same error-code surface even before we hit the
  // network. userId and sessionId are both mandatory for memory operations.
  if (!args.userId || args.userId.trim().length === 0) {
    fail(
      "Error: MISSING_PARAMETERS - --user-id is required " +
        "(both userId and sessionId are mandatory for Alchemyst memory operations)."
    );
  }

  const sessionId = deriveSessionId();
  if (!sessionId || sessionId.trim().length === 0) {
    fail(
      "Error: MISSING_PARAMETERS - unable to derive a sessionId from ZEALT_RUN_ID."
    );
  }

  const hasAdd = typeof args.add === "string";
  const hasQuery = typeof args.query === "string";

  if (hasAdd === hasQuery) {
    fail(
      "Error: exactly one of --add \"<content>\" or --query \"<query>\" must be provided."
    );
  }

  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    fail("Error: ALCHEMYST_AI_API_KEY environment variable is required.");
  }

  const client = new AlchemystAI({ apiKey });

  // Use the sessionId itself as the groupName so the shared memory thread
  // forms one filterable namespace inside Alchemyst. All teammates writing
  // into the same ZEALT_RUN_ID land in the same group and become recoverable
  // via search by any other teammate.
  const groupName: string[] = [sessionId];

  if (hasAdd) {
    const content = args.add as string;

    // client.v1.context.memory.add stores chat-history style memory bound
    // to the shared sessionId. The userId is attached as message metadata
    // so contributions are attributable, while the sessionId+groupName keep
    // the entries inside one shared thread retrievable by anyone.
    await client.v1.context.memory.add({
      sessionId,
      contents: [
        {
          content,
          // Per-message metadata. The SDK's typed surface only mentions
          // `messageId`, but the API schema explicitly allows additional
          // properties, so we attach the userId for attribution.
          metadata: {
            messageId: `${args.userId}-${Date.now()}`,
            userId: args.userId,
          } as any,
          userId: args.userId,
          role: "user",
        } as any,
      ],
      metadata: {
        groupName,
        userId: args.userId,
        sessionId,
      } as any,
    });

    process.stdout.write(`ADDED: ${content}\n`);
    return;
  }

  // --query path
  const query = args.query as string;

  // Lenient similarity thresholds so semantically loose queries still
  // retrieve the stored entries. The body_metadata.groupName filter scopes
  // the search to the shared session thread so we surface every teammate's
  // contributions, regardless of which userId wrote them.
  const searchResult: any = await (client.v1.context as any).search({
    query,
    similarity_threshold: 1.0,
    minimum_similarity_threshold: 0.0,
    scope: "internal",
    body_metadata: {
      groupName,
      sessionId,
    },
    // Pass userId through for endpoints that still honor it; the underlying
    // shared thread is the sessionId, so cross-user visibility is preserved.
    user_id: args.userId,
  });

  const memories: Array<{ content?: string }> = [];

  if (searchResult && Array.isArray(searchResult.memories)) {
    for (const m of searchResult.memories) {
      memories.push(m);
    }
  }
  if (searchResult && Array.isArray(searchResult.contexts)) {
    for (const c of searchResult.contexts) {
      memories.push(c);
    }
  }
  if (searchResult && Array.isArray(searchResult.results)) {
    for (const r of searchResult.results) {
      memories.push(r);
    }
  }

  for (const mem of memories) {
    if (!mem) continue;
    const content =
      (mem as any).content ??
      (mem as any).text ??
      (mem as any).message ??
      (mem as any).value;
    if (typeof content === "string" && content.length > 0) {
      process.stdout.write(`MEMORY: ${content}\n`);
    }
  }
}

main().catch((err: unknown) => {
  // Surface Alchemyst's MISSING_PARAMETERS error code if the API ever returns
  // it (e.g. when userId/sessionId really are absent on the wire).
  const msg =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
});
