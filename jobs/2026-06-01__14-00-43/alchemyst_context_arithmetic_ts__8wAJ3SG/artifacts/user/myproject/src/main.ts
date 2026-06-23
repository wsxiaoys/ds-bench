import AlchemystAI from '@alchemystai/sdk';

// ---------------------------------------------------------------------------
// Seed corpus definition
// ---------------------------------------------------------------------------
interface SeedDoc {
  key: string;
  groups: string[];
  content: string;
}

const SEED_DOCS: SeedDoc[] = [
  {
    key: 'ENG_V1_DOC',
    groups: ['eng', 'v1'],
    content:
      'Engineering notes for API version 1. Key: ENG_V1_DOC. This document covers the v1 API design decisions, endpoint specifications, and engineering guidelines for the initial release.',
  },
  {
    key: 'ENG_V2_DOC',
    groups: ['eng', 'v2'],
    content:
      'Engineering notes for API version 2. Key: ENG_V2_DOC. This document covers the v2 API redesign, breaking changes, migration guide, and engineering standards for the second release.',
  },
  {
    key: 'PRODUCT_V1_DOC',
    groups: ['product', 'v1'],
    content:
      'Product notes for release version 1. Key: PRODUCT_V1_DOC. This document covers product requirements, feature scope, user stories, and product roadmap for release version 1.',
  },
  {
    key: 'PRODUCT_V2_DOC',
    groups: ['product', 'v2'],
    content:
      'Product notes for release version 2. Key: PRODUCT_V2_DOC. This document covers product updates, new features, market feedback, and product roadmap for release version 2.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string): void {
  process.stderr.write(`[alchemyst-cli] ${msg}\n`);
}

function parseArgs(argv: string[]): string[] {
  const groupsIdx = argv.indexOf('--groups');
  if (groupsIdx === -1) {
    log('Usage: node dist/main.js --groups <group1> [group2] ...');
    process.exit(1);
  }
  const groups = argv.slice(groupsIdx + 1);
  if (groups.length === 0) {
    log('Error: At least one group must be specified after --groups');
    process.exit(1);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    log('Error: ALCHEMYST_AI_API_KEY environment variable is not set');
    process.exit(1);
  }

  const runId = process.env.ZEALT_RUN_ID || 'default';
  const groups = parseArgs(process.argv.slice(2));

  log(`Run ID: ${runId}`);
  log(`Filter groups: ${groups.join(', ')}`);

  const client = new AlchemystAI({ apiKey });

  // -----------------------------------------------------------------------
  // Step 1: Delete any existing documents from prior runs to avoid 409s
  // -----------------------------------------------------------------------
  for (const doc of SEED_DOCS) {
    const fileName = `${doc.key}-${runId}.md`;
    try {
      log(`Deleting existing document: ${fileName}`);
      // The SDK types for delete don't include metadata, but the API accepts it.
      // Using as any to bypass the type checker.
      await client.v1.context.delete({
        metadata: { fileName },
      } as any);
      log(`Deleted: ${fileName}`);
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      if (status === 404) {
        log(`Document not found (expected for first run): ${fileName}`);
      } else {
        log(`Delete response for ${fileName}: ${err?.message || err}`);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Step 2: Ingest the seed corpus
  // -----------------------------------------------------------------------
  for (const doc of SEED_DOCS) {
    const fileName = `${doc.key}-${runId}.md`;
    log(`Ingesting document: ${fileName} (groups: ${doc.groups.join(', ')})`);
    try {
      // The SDK Document type doesn't include metadata as an object,
      // but the API accepts it. Using as any to bypass the type checker.
      await client.v1.context.add({
        documents: [
          {
            content: doc.content,
            metadata: {
              file_name: fileName,
              group_name: doc.groups,
            },
          } as any,
        ],
        context_type: 'resource',
        source: 'documentation',
        scope: 'internal',
      });
      log(`Ingested: ${fileName}`);
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      if (status === 409) {
        log(`Document already exists (409), skipping: ${fileName}`);
      } else {
        log(`Error ingesting ${fileName}: ${err?.message || err}`);
        throw err;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Step 3: Wait briefly for indexing to complete
  // -----------------------------------------------------------------------
  log('Waiting for indexing to settle...');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // -----------------------------------------------------------------------
  // Step 4: Perform intersection search
  // -----------------------------------------------------------------------
  log(`Searching with groups: ${groups.join(', ')} (intersection)`);
  const { contexts } = await client.v1.context.search({
    query: 'engineering product notes version release API',
    similarity_threshold: 0.1,
    minimum_similarity_threshold: 0.1,
    scope: 'internal',
    metadata: {
      groupName: groups,
    },
  });

  log(`Raw results: ${contexts?.length ?? 0} chunks returned`);

  // -----------------------------------------------------------------------
  // Step 5: Map chunks back to seed keys and deduplicate
  // -----------------------------------------------------------------------
  const keySet = new Set<string>();

  for (const chunk of contexts ?? []) {
    const content: string = chunk.content ?? '';
    for (const doc of SEED_DOCS) {
      if (content.includes(doc.key)) {
        keySet.add(doc.key);
      }
    }
  }

  const results = Array.from(keySet).map((key) => ({ key }));

  // Print ONLY the JSON array to stdout
  process.stdout.write(JSON.stringify(results, null, 2) + '\n');

  log(`Matched keys: ${Array.from(keySet).join(', ') || '(none)'}`);
}

main().catch((err) => {
  log(`Fatal error: ${err?.message || err}`);
  process.exit(1);
});