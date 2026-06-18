/**
 * Context Arithmetic Intersection Search CLI
 *
 * Demonstrates the parameter casing quirk in @alchemystai/sdk:
 *  - When adding   : metadata.group_name (snake_case)
 *  - When searching: metadata.groupName  (camelCase)
 *
 * Usage:
 *   node dist/main.js --groups <g1> [<g2> ...]
 */

import AlchemystAI from "@alchemystai/sdk";

type SeedDoc = {
  key: string;
  groups: string[];
  content: string;
};

const SEED_CORPUS: SeedDoc[] = [
  {
    key: "ENG_V1_DOC",
    groups: ["eng", "v1"],
    content:
      "ENG_V1_DOC: Engineering notes for API version 1. Covers v1 endpoints, authentication, request schemas, " +
      "deployment, error codes, and engineering operations for the v1 API. Internal engineering reference document.",
  },
  {
    key: "ENG_V2_DOC",
    groups: ["eng", "v2"],
    content:
      "ENG_V2_DOC: Engineering notes for API version 2. Covers v2 endpoints, authentication, request schemas, " +
      "deployment, error codes, and engineering operations for the v2 API. Internal engineering reference document.",
  },
  {
    key: "PRODUCT_V1_DOC",
    groups: ["product", "v1"],
    content:
      "PRODUCT_V1_DOC: Product notes for release version 1. Covers v1 product features, roadmap, customer " +
      "experience, marketing positioning, and product strategy for release v1. Internal product reference document.",
  },
  {
    key: "PRODUCT_V2_DOC",
    groups: ["product", "v2"],
    content:
      "PRODUCT_V2_DOC: Product notes for release version 2. Covers v2 product features, roadmap, customer " +
      "experience, marketing positioning, and product strategy for release v2. Internal product reference document.",
  },
];

function log(...args: unknown[]) {
  // Send all logs to stderr so stdout stays a clean JSON array.
  process.stderr.write(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ") + "\n");
}

function parseArgs(argv: string[]): string[] {
  const idx = argv.indexOf("--groups");
  if (idx === -1) {
    log("Error: missing --groups <group1> [<group2> ...] argument.");
    process.exit(2);
  }
  const groups: string[] = [];
  for (let i = idx + 1; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) break;
    groups.push(a);
  }
  if (groups.length === 0) {
    log("Error: --groups must be followed by at least one group name.");
    process.exit(2);
  }
  return groups;
}

async function main() {
  const groups = parseArgs(process.argv.slice(2));

  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    log("Error: ALCHEMYST_AI_API_KEY is not set.");
    process.exit(2);
  }

  const runId = process.env.ZEALT_RUN_ID || "local";
  const client = new AlchemystAI({ apiKey });

  log(`Run ID: ${runId}`);
  log(`Filter groups (intersection): ${JSON.stringify(groups)}`);

  // ---------------------------------------------------------------------------
  // 1. Ingest the fixed seed corpus.
  //    NOTE: when ADDING, the metadata key is `group_name` (snake_case).
  //    The file_name is suffixed with ZEALT_RUN_ID so reruns are isolated.
  // ---------------------------------------------------------------------------
  for (const doc of SEED_CORPUS) {
    const fileName = `${doc.key}-${runId}.md`;
    const nowIso = new Date().toISOString();
    const addBody: any = {
      context_type: "resource",
      scope: "internal",
      source: "context-arithmetic-cli",
      documents: [
        {
          content: doc.content,
          // Per-document metadata uses snake_case `group_name`. This is the
          // documented quirk: ADD uses snake_case `group_name`.
          metadata: {
            file_name: fileName,
            file_type: "text/markdown",
            file_size: doc.content.length,
            last_modified: nowIso,
            group_name: doc.groups,
          },
        },
      ],
      // Top-level metadata is validated server-side and requires camelCase
      // fileName/fileSize/fileType/lastModified/groupName. Mirror it here.
      metadata: {
        fileName: fileName,
        fileSize: doc.content.length,
        fileType: "text/markdown",
        lastModified: nowIso,
        groupName: doc.groups,
      },
    };

    try {
      await client.v1.context.add(addBody);
      log(`Added ${doc.key} (${fileName}) groups=${JSON.stringify(doc.groups)}`);
    } catch (err: any) {
      // Tolerate 409 conflicts so the CLI is safely rerunnable with the
      // same ZEALT_RUN_ID. Any other error is fatal.
      const status = err?.status ?? err?.statusCode;
      const msg = String(err?.message ?? err);
      if (status === 409 || /conflict|already exists/i.test(msg)) {
        log(`Document ${doc.key} (${fileName}) already exists; reusing.`);
      } else {
        log(`Failed to add ${doc.key}: status=${status} message=${msg}`);
        throw err;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Run the Context Arithmetic intersection search.
  //    NOTE: when SEARCHING, the metadata key is `groupName` (camelCase).
  //    All CLI groups are passed as a single array — Alchemyst computes the
  //    intersection (set AND) of those groups.
  // ---------------------------------------------------------------------------
  const query =
    "engineering and product notes for api and release versions v1 v2 documentation reference";

  // The search uses the camelCase TypeScript SDK form: { groupName: [...] }.
  // The Alchemyst API reads the filter from the body field `metadata`. The
  // current generated TS SDK reserves `params.metadata` for a query-string
  // flag, so we call the lower-level `client.post` to send the body verbatim
  // with `metadata: { groupName: [...] }` — the exact documented shape.
  const searchBody: any = {
    query,
    scope: "internal",
    similarity_threshold: 0.1,
    minimum_similarity_threshold: 0.0,
    metadata: {
      groupName: groups,
    },
  };

  log(`Searching with params: ${JSON.stringify({ query, groupName: groups })}`);

  const resp: any = await (client as any).post("/api/v1/context/search", {
    body: searchBody,
    query: { metadata: "true" },
  });
  const contexts: any[] = resp?.contexts ?? [];
  log(`Search returned ${contexts.length} raw chunk(s).`);

  // ---------------------------------------------------------------------------
  // 3. Map each chunk back to one of the 4 seed keys via the literal key
  //    embedded in the content. Deduplicate by key.
  // ---------------------------------------------------------------------------
  const seedKeys = SEED_CORPUS.map((d) => d.key);
  const seenKeys = new Set<string>();
  const results: Array<{ key: string; content: string; file_name?: string }> = [];

  for (const ctx of contexts) {
    const content: string = ctx?.content ?? "";
    const fileName: string | undefined =
      ctx?.metadata?.fileName ?? ctx?.metadata?.file_name ?? undefined;

    let matched: string | undefined;
    for (const k of seedKeys) {
      if (content.includes(k) || (fileName && fileName.startsWith(`${k}-`))) {
        matched = k;
        break;
      }
    }
    if (!matched) continue;
    if (seenKeys.has(matched)) continue;
    seenKeys.add(matched);
    results.push({ key: matched, content, file_name: fileName });
  }

  // Deterministic ordering for easier human verification.
  results.sort((a, b) => a.key.localeCompare(b.key));

  // ---------------------------------------------------------------------------
  // 4. Emit exactly one JSON array on stdout.
  // ---------------------------------------------------------------------------
  process.stdout.write(JSON.stringify(results));
}

main().catch((err) => {
  log("Fatal:", err?.stack || String(err));
  process.exit(1);
});
