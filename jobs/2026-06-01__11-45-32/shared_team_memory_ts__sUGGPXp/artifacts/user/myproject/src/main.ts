import { AlchemystAI } from "@alchemystai/sdk";

type Operation =
  | { type: "add"; value: string }
  | { type: "query"; value: string };

const args = process.argv.slice(2);
let userId: string | undefined;
let operation: Operation | undefined;
let hasError = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--user-id") {
    const value = args[i + 1];
    if (!value) {
      hasError = true;
      break;
    }
    userId = value;
    i += 1;
    continue;
  }
  if (arg === "--add" || arg === "--query") {
    if (operation) {
      hasError = true;
      break;
    }
    const value = args[i + 1];
    if (!value) {
      hasError = true;
      break;
    }
    operation = {
      type: arg === "--add" ? "add" : "query",
      value,
    };
    i += 1;
    continue;
  }
  hasError = true;
  break;
}

if (!userId) {
  console.error("MISSING_PARAMETERS: userId is required");
  process.exit(1);
}

if (hasError || !operation) {
  console.error("INVALID_PARAMETERS: specify exactly one of --add or --query with values");
  process.exit(1);
}

const runId = process.env.ZEALT_RUN_ID ?? "unknown";
const sessionId = `team-standup-${runId}`;
const apiKey = process.env.ALCHEMYST_AI_API_KEY;

const client = new AlchemystAI({
  apiKey,
});

const toContentString = (memory: Record<string, unknown>): string => {
  const content = memory.content ?? memory.text ?? memory["value"];
  if (typeof content === "string") {
    return content;
  }
  return JSON.stringify(content ?? memory);
};

const main = async () => {
  if (operation.type === "add") {
    await client.v1.context.memory.add({
      userId,
      sessionId,
      content: operation.value,
    });
    console.log(`ADDED: ${operation.value}`);
    return;
  }

  const result = await client.v1.context.memory.search({
    userId,
    sessionId,
    query: operation.value,
    minimum_similarity_threshold: 0.2,
  });

  const memories = Array.isArray(result?.memories) ? result.memories : [];
  for (const memory of memories) {
    console.log(`MEMORY: ${toContentString(memory as Record<string, unknown>)}`);
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
