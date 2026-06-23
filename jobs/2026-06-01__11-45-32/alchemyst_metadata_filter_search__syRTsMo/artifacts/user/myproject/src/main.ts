import { AlchemystAI } from "@alchemystai/sdk";

const SUPPORTED_GROUPS = new Set(["support", "engineering"]);

type ContextDocument = {
  content: string;
  metadata: {
    file_name: string;
    group_name: string[];
  };
};

const getArgValue = (flag: string): string | null => {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return null;
  }
  return process.argv[index + 1];
};

const isConflictError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeError = error as {
    status?: number;
    response?: { status?: number };
  };
  return maybeError.status === 409 || maybeError.response?.status === 409;
};

const seedDocument = async (
  client: AlchemystAI,
  document: ContextDocument
): Promise<void> => {
  try {
    await client.v1.context.add({
      documents: [document],
      context_type: "resource",
      source: "docs",
      scope: "internal",
    });
    console.error(`Seeded ${document.metadata.file_name}`);
  } catch (error) {
    if (isConflictError(error)) {
      console.error(`Skipped existing ${document.metadata.file_name}`);
      return;
    }
    throw error;
  }
};

const main = async (): Promise<void> => {
  const group = getArgValue("--group");
  if (!group) {
    throw new Error("Missing required --group <group_name> argument.");
  }
  if (!SUPPORTED_GROUPS.has(group)) {
    throw new Error("--group must be one of: support, engineering.");
  }

  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    throw new Error("ALCHEMYST_AI_API_KEY environment variable is required.");
  }
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error("ZEALT_RUN_ID environment variable is required.");
  }

  const client = new AlchemystAI({ apiKey });

  const documents: ContextDocument[] = [
    {
      content: "Support guide: reset password steps.",
      metadata: {
        file_name: `support-reset-${runId}.md`,
        group_name: ["support"],
      },
    },
    {
      content: "Support policy: escalation matrix.",
      metadata: {
        file_name: `support-escalation-${runId}.md`,
        group_name: ["support"],
      },
    },
    {
      content: "Engineering runbook: deploy pipeline overview.",
      metadata: {
        file_name: `engineering-deploy-${runId}.md`,
        group_name: ["engineering"],
      },
    },
    {
      content: "Engineering RFC: API caching strategy.",
      metadata: {
        file_name: `engineering-caching-${runId}.md`,
        group_name: ["engineering"],
      },
    },
  ];

  for (const document of documents) {
    await seedDocument(client, document);
  }

  const searchResponse = await client.v1.context.search({
    query: `group search for ${group}`,
    scope: "internal",
    metadata: {
      groupName: [group],
    },
  });

  const fileNames = new Set<string>();
  const contexts = (searchResponse as { contexts?: Array<{ metadata?: unknown }> })
    .contexts;
  if (Array.isArray(contexts)) {
    for (const context of contexts) {
      const metadata = context.metadata as { file_name?: string } | undefined;
      if (metadata?.file_name) {
        fileNames.add(metadata.file_name);
      }
    }
  }

  process.stdout.write(`${JSON.stringify([...fileNames])}\n`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
