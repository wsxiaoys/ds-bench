import AlchemystAI from '@alchemystai/sdk';

const DOCUMENT_KEYS = [
  'ENG_V1_DOC',
  'ENG_V2_DOC',
  'PRODUCT_V1_DOC',
  'PRODUCT_V2_DOC',
] as const;

type SeedDocument = {
  key: (typeof DOCUMENT_KEYS)[number];
  groups: string[];
  content: string;
};

const SEED_DOCUMENTS: SeedDocument[] = [
  {
    key: 'ENG_V1_DOC',
    groups: ['eng', 'v1'],
    content:
      'ENG_V1_DOC Engineering notes for API version 1. This document covers v1 endpoints, stability, and migration notes.',
  },
  {
    key: 'ENG_V2_DOC',
    groups: ['eng', 'v2'],
    content:
      'ENG_V2_DOC Engineering notes for API version 2. This document covers v2 endpoints, performance, and rollout details.',
  },
  {
    key: 'PRODUCT_V1_DOC',
    groups: ['product', 'v1'],
    content:
      'PRODUCT_V1_DOC Product notes for release version 1. This document describes v1 launch highlights and positioning.',
  },
  {
    key: 'PRODUCT_V2_DOC',
    groups: ['product', 'v2'],
    content:
      'PRODUCT_V2_DOC Product notes for release version 2. This document outlines v2 features and roadmap changes.',
  },
];

const KEY_PATTERN = new RegExp(DOCUMENT_KEYS.join('|'), 'g');

const getGroupsFromArgs = (args: string[]): string[] => {
  const groupsIndex = args.indexOf('--groups');
  if (groupsIndex === -1) {
    return [];
  }
  const groups = args.slice(groupsIndex + 1).filter((value) => !value.startsWith('--'));
  return groups;
};

const extractKey = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  const match = value.match(KEY_PATTERN);
  if (!match) {
    return null;
  }
  return match[0] ?? null;
};

const toErrorStatus = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const status = (error as { status?: number; statusCode?: number }).status;
  if (typeof status === 'number') {
    return status;
  }
  const statusCode = (error as { statusCode?: number }).statusCode;
  if (typeof statusCode === 'number') {
    return statusCode;
  }
  const responseStatus = (error as { response?: { status?: number } }).response?.status;
  if (typeof responseStatus === 'number') {
    return responseStatus;
  }
  return null;
};

const main = async () => {
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error('Missing ALCHEMYST_AI_API_KEY in environment.');
    process.exit(1);
  }

  const runId = process.env.ZEALT_RUN_ID ?? 'local';
  const groups = getGroupsFromArgs(process.argv.slice(2));
  if (groups.length === 0) {
    console.error('Usage: node dist/main.js --groups <group1> [<group2> ...]');
    process.exit(1);
  }

  const client = new AlchemystAI({ apiKey });

  for (const doc of SEED_DOCUMENTS) {
    const fileName = `${doc.key}-${runId}.md`;
    try {
      await client.v1.context.add({
        documents: [
          {
            content: doc.content,
          },
        ],
        context_type: 'resource',
        source: 'cli-seed',
        scope: 'internal',
        metadata: {
          file_name: fileName,
          group_name: doc.groups,
          key: doc.key,
        },
      });
    } catch (error) {
      const status = toErrorStatus(error);
      if (status !== 409) {
        console.error('Failed to add context:', error);
        process.exit(1);
      }
    }
  }

  const query =
    'Engineering and product notes for API and release versions across v1 and v2.';

  let contexts: Array<Record<string, unknown>> = [];
  try {
    const response = await client.v1.context.search({
      query,
      similarity_threshold: 0.1,
      minimum_similarity_threshold: 0.05,
      scope: 'internal',
      metadata: {
        groupName: groups,
      },
    });
    const responseContexts = (response as { contexts?: Array<Record<string, unknown>> })
      .contexts;
    if (Array.isArray(responseContexts)) {
      contexts = responseContexts;
    }
  } catch (error) {
    console.error('Search failed:', error);
    process.exit(1);
  }

  const results: Array<Record<string, unknown>> = [];
  const seenKeys = new Set<string>();

  for (const context of contexts) {
    const metadata = context.metadata as Record<string, unknown> | undefined;
    const content =
      (context.content as string | undefined) ??
      (context.document as { content?: string } | undefined)?.content;

    const keyFromMetadata = typeof metadata?.key === 'string' ? metadata.key : null;
    const keyFromContent = extractKey(content);
    const key = keyFromMetadata ?? keyFromContent;
    if (!key || seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    results.push({
      key,
      content,
      file_name: typeof metadata?.file_name === 'string' ? metadata.file_name : undefined,
    });
  }

  process.stdout.write(JSON.stringify(results));
};

main().catch((error) => {
  console.error('Unexpected failure:', error);
  process.exit(1);
});
