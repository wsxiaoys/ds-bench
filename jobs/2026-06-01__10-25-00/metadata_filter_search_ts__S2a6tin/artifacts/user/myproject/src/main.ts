import { AlchemystAI } from '@alchemystai/sdk';

async function main() {
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  const runId = process.env.ZEALT_RUN_ID;

  if (!apiKey) {
    console.error("Error: ALCHEMYST_AI_API_KEY environment variable is missing.");
    process.exit(1);
  }

  if (!runId) {
    console.error("Error: ZEALT_RUN_ID environment variable is missing.");
    process.exit(1);
  }

  // Parse command line arguments
  let group: string | null = null;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--group' && i + 1 < args.length) {
      group = args[i + 1];
      break;
    }
  }

  if (!group) {
    console.error("Error: Missing required argument --group <group_name>");
    process.exit(1);
  }

  if (group !== 'support' && group !== 'engineering') {
    console.error("Error: --group must be one of 'support' or 'engineering'");
    process.exit(1);
  }

  // Initialize Alchemyst AI client
  const client = new AlchemystAI({
    apiKey: apiKey,
  });

  // Intercept the search method to bypass the SDK query string serialization bug
  // and properly format the metadata filter in the body.
  const originalSearch = client.v1.context.search.bind(client.v1.context);
  client.v1.context.search = function (params: any, options?: any) {
    if (params && typeof params.metadata === 'object') {
      const { metadata, ...rest } = params;
      return client.post('/api/v1/context/search', {
        query: { metadata: 'true', mode: params.mode || 'standard' },
        body: {
          ...rest,
          metadata: metadata,
          body_metadata: metadata,
        },
        ...options
      });
    }
    return originalSearch(params, options);
  };

  const documentsToSeed = [
    {
      content: `This is support document one containing customer service guidelines for run ${runId}.`,
      metadata: {
        file_name: `support_doc1_${runId}.txt`,
        group_name: ["support"]
      }
    },
    {
      content: `This is support document two discussing refund and return policies for run ${runId}.`,
      metadata: {
        file_name: `support_doc2_${runId}.txt`,
        group_name: ["support"]
      }
    },
    {
      content: `This is engineering document one describing system architecture and API endpoints for run ${runId}.`,
      metadata: {
        file_name: `engineering_doc1_${runId}.txt`,
        group_name: ["engineering"]
      }
    },
    {
      content: `This is engineering document two detailing deployment pipelines and CI/CD setup for run ${runId}.`,
      metadata: {
        file_name: `engineering_doc2_${runId}.txt`,
        group_name: ["engineering"]
      }
    }
  ];

  console.error("Seeding documents...");
  for (const doc of documentsToSeed) {
    try {
      await client.v1.context.add({
        documents: [
          {
            content: doc.content,
            metadata: doc.metadata
          } as any
        ],
        context_type: 'resource',
        source: 'docs',
        scope: 'internal',
        metadata: {
          fileName: doc.metadata.file_name,
          groupName: doc.metadata.group_name,
          fileSize: 1024,
          fileType: 'text/plain',
          lastModified: new Date().toISOString()
        }
      });
      console.error(`Successfully seeded document: ${doc.metadata.file_name}`);
    } catch (error: any) {
      if (error.status === 409 || error.statusCode === 409 || (error.message && error.message.includes('409'))) {
        console.error(`Document already exists (409 conflict ignored): ${doc.metadata.file_name}`);
      } else {
        console.error(`Failed to seed document ${doc.metadata.file_name}:`, error);
        throw error;
      }
    }
  }

  // Give the context processor a moment to index the documents
  console.error("Waiting for indexing...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.error(`Searching for group: ${group}...`);
  try {
    const response = await client.v1.context.search({
      query: `document ${runId}`,
      scope: 'internal',
      minimum_similarity_threshold: 0.1,
      similarity_threshold: 0.3,
      metadata: {
        groupName: [group]
      }
    } as any);

    console.error("Raw search response:", JSON.stringify(response, null, 2));

    const fileNames = new Set<string>();
    if (response && response.contexts) {
      for (const context of response.contexts) {
        const meta = context.metadata as any;
        if (meta) {
          const fileName = meta.file_name || meta.fileName;
          if (fileName) {
            fileNames.add(fileName);
          }
        }
      }
    }

    console.log(JSON.stringify(Array.from(fileNames)));
  } catch (error) {
    console.error("Search failed:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
