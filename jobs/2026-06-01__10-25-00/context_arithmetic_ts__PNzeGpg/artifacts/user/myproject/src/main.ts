import { AlchemystAI, ConflictError } from '@alchemystai/sdk';

async function main() {
  // 1. Argument parsing
  const args = process.argv;
  const groupsIndex = args.indexOf('--groups');
  if (groupsIndex === -1) {
    console.error("Error: --groups flag is required.");
    process.exit(1);
  }

  const groups = args.slice(groupsIndex + 1);

  // 2. Initialize Alchemyst AI client
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error("Error: ALCHEMYST_AI_API_KEY environment variable is not set.");
    process.exit(1);
  }

  const runId = process.env.ZEALT_RUN_ID || 'default-run-id';
  console.error(`Using ZEALT_RUN_ID: ${runId}`);

  const client = new AlchemystAI({
    apiKey: apiKey,
  });

  // 3. Define the fixed seed corpus of 4 documents
  const seedDocuments = [
    {
      key: "ENG_V1_DOC",
      groups: ["eng", "v1"],
      content: "This document contains the engineering notes for API version 1. Key: ENG_V1_DOC. We discuss the design of the new auth endpoint and how v1 handles requests."
    },
    {
      key: "ENG_V2_DOC",
      groups: ["eng", "v2"],
      content: "This document contains the engineering notes for API version 2. Key: ENG_V2_DOC. We discuss the migration paths and how v2 improves performance."
    },
    {
      key: "PRODUCT_V1_DOC",
      groups: ["product", "v1"],
      content: "This document contains the product notes for release version 1. Key: PRODUCT_V1_DOC. We outline the product roadmap and features for v1 launch."
    },
    {
      key: "PRODUCT_V2_DOC",
      groups: ["product", "v2"],
      content: "This document contains the product notes for release version 2. Key: PRODUCT_V2_DOC. We outline the product roadmap and features for v2 launch."
    }
  ];

  // 4. Ingest the seed corpus
  console.error("Ingesting documents...");
  for (const doc of seedDocuments) {
    const fileName = `${doc.key}-${runId}.md`;
    try {
      // Storage uses group_name (snake_case) inside metadata
      await client.v1.context.add({
        context_type: 'resource',
        source: 'my-cli-source',
        scope: 'internal',
        documents: [
          {
            content: doc.content,
            metadata: {
              file_name: fileName,
              group_name: doc.groups,
              fileName: fileName,
              groupName: doc.groups
            }
          }
        ],
        metadata: {
          fileName: fileName,
          fileSize: Buffer.byteLength(doc.content),
          fileType: 'text/markdown',
          lastModified: new Date().toISOString(),
          group_name: doc.groups,
          groupName: doc.groups
        }
      } as any);
      console.error(`Successfully ingested ${fileName}`);
    } catch (err: any) {
      const isConflict = 
        err instanceof ConflictError || 
        err.status === 409 || 
        (err.message && err.message.toLowerCase().includes('already exists')) ||
        (err.message && err.message.toLowerCase().includes('conflict'));

      if (isConflict) {
        console.error(`Document ${fileName} already exists (409 Conflict). Tolerating and continuing.`);
      } else {
        console.error(`Error ingesting ${fileName}:`, err);
        throw err;
      }
    }
  }

  // 5. Perform the Context Arithmetic search
  console.error(`Searching with groups: ${JSON.stringify(groups)}`);
  
  // Search uses groupName (camelCase) inside metadata
  const response = await client.v1.context.search({
    query: "engineering product version notes Key",
    scope: 'internal',
    similarity_threshold: 0.1,
    minimum_similarity_threshold: 0.1,
    metadata: 'true'
  } as any, {
    body: {
      query: "engineering product version notes Key",
      scope: 'internal',
      similarity_threshold: 0.1,
      minimum_similarity_threshold: 0.1,
      metadata: {
        groupName: groups
      },
      body_metadata: {
        groupName: groups
      }
    }
  } as any);

  const contexts = response.contexts || [];
  console.error(`Found ${contexts.length} raw search context chunks.`);

  // 6. Deduplicate and map back to the 4 seed documents using strict intersection semantics
  const isSuperset = (documentGroups: string[], cliGroups: string[]) => {
    return cliGroups.every(g => documentGroups.includes(g));
  };

  const matchedKeys = new Set<string>();
  const results: any[] = [];

  for (const ctx of contexts) {
    if (!ctx.content) continue;
    for (const doc of seedDocuments) {
      if (ctx.content.includes(doc.key)) {
        if (isSuperset(doc.groups, groups)) {
          if (!matchedKeys.has(doc.key)) {
            matchedKeys.add(doc.key);
            results.push({
              key: doc.key,
              content: ctx.content
            });
          }
        }
      }
    }
  }

  // Print EXACTLY one JSON array to stdout
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});