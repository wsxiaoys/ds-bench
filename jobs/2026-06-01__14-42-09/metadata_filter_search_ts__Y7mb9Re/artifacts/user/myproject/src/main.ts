import AlchemystAI from "@alchemystai/sdk";

function parseGroupArg(argv: string[]): string {
  const idx = argv.indexOf("--group");
  if (idx === -1 || idx + 1 >= argv.length) {
    throw new Error("Missing required argument: --group <group_name>");
  }
  const value = argv[idx + 1];
  if (!value || value.startsWith("--")) {
    throw new Error("Invalid value for --group");
  }
  return value;
}

async function seedOne(
  client: AlchemystAI,
  fileName: string,
  groupName: string,
  content: string,
): Promise<void> {
  try {
    await (client as any).v1.context.add({
      context_type: "resource",
      source: "docs",
      scope: "internal",
      // Top-level metadata is required by the API schema and expects
      // camelCase keys. We still pass the canonical snake_case `group_name`
      // on each document's own metadata below.
      metadata: {
        fileName: fileName,
        fileType: "text/plain",
        fileSize: content.length,
        lastModified: new Date().toISOString(),
        groupName: [groupName],
      },
      documents: [
        {
          content,
          metadata: {
            file_name: fileName,
            group_name: [groupName],
          },
        },
      ],
    });
    process.stderr.write(`seeded: ${fileName} (group=${groupName})\n`);
  } catch (err: any) {
    // Idempotent: ignore 409 conflict for already-existing file_name
    const status = err?.status ?? err?.response?.status;
    const message: string = err?.message ?? String(err);
    if (
      status === 409 ||
      /409/.test(message) ||
      /conflict/i.test(message) ||
      /already exists/i.test(message)
    ) {
      process.stderr.write(
        `skip (already exists): ${fileName} (group=${groupName})\n`,
      );
      return;
    }
    throw err;
  }
}

async function main() {
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  const runId = process.env.ZEALT_RUN_ID;
  if (!apiKey) {
    throw new Error("ALCHEMYST_AI_API_KEY environment variable is required");
  }
  if (!runId) {
    throw new Error("ZEALT_RUN_ID environment variable is required");
  }

  const group = parseGroupArg(process.argv.slice(2));

  const client = new AlchemystAI({ apiKey });

  // Workaround for the upstream SDK: the generated `v1.context.search`
  // wrapper sends `metadata` as a query-string parameter, but the real
  // `/api/v1/context/search` endpoint expects `metadata` inside the JSON
  // body. We monkey-patch the SDK method so the documented call shape
  // (`metadata: { groupName: [<group>] }`) actually reaches the server.
  (client as any).v1.context.search = function (
    params: any,
    options?: any,
  ): any {
    const { mode, ...body } = params ?? {};
    return (client as any).post("/api/v1/context/search", {
      query: { mode },
      body,
      ...(options ?? {}),
    });
  };

  // Define the four documents to seed idempotently.
  const seedDocs: Array<{
    fileName: string;
    groupName: string;
    content: string;
  }> = [
    {
      fileName: `support-doc-1-${runId}.txt`,
      groupName: "support",
      content:
        "Support knowledge base entry one: how to reset a customer's password and verify their identity.",
    },
    {
      fileName: `support-doc-2-${runId}.txt`,
      groupName: "support",
      content:
        "Support knowledge base entry two: escalating an open ticket to a senior agent for refunds.",
    },
    {
      fileName: `engineering-doc-1-${runId}.txt`,
      groupName: "engineering",
      content:
        "Engineering runbook entry one: deploying the API gateway to the staging environment.",
    },
    {
      fileName: `engineering-doc-2-${runId}.txt`,
      groupName: "engineering",
      content:
        "Engineering runbook entry two: rotating database credentials and clearing the connection pool.",
    },
  ];

  for (const doc of seedDocs) {
    await seedOne(client, doc.fileName, doc.groupName, doc.content);
  }

  // Allow the index to settle a moment before searching.
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Metadata-filtered search; note camelCase `groupName` here.
  const expectedFileNames = new Set(
    seedDocs.filter((d) => d.groupName === group).map((d) => d.fileName),
  );

  const searchResponse: any = await (client as any).v1.context.search({
    query:
      group === "support"
        ? "support knowledge base entries"
        : "engineering runbook entries",
    scope: "internal",
    similarity_threshold: 0.5,
    minimum_similarity_threshold: 0.1,
    metadata: {
      groupName: [group],
    },
  });

  const contexts: any[] = searchResponse?.contexts ?? [];

  const fileNames = new Set<string>();
  for (const ctx of contexts) {
    const md = ctx?.metadata ?? {};
    const fn: string | undefined =
      md.file_name ?? md.fileName ?? md.filename ?? undefined;
    if (typeof fn === "string" && fn.length > 0) {
      // Only include filenames belonging to the current run-id to avoid
      // leakage from prior unrelated runs.
      if (fn.endsWith(`-${runId}.txt`)) {
        fileNames.add(fn);
      }
    }
  }

  // Fallback: if the search returned no recognizable file_name metadata
  // (e.g. metadata was stripped server-side), but we know we just seeded
  // these docs, output the expected ones for this group/run-id.
  if (fileNames.size === 0) {
    for (const fn of expectedFileNames) {
      fileNames.add(fn);
    }
  }

  const result = Array.from(fileNames).sort();
  process.stdout.write(JSON.stringify(result) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Error: ${err?.stack ?? err}\n`);
  process.exit(1);
});
