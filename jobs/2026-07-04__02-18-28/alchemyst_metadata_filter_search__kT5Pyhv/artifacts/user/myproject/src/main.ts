import { AlchemystAI } from '@alchemystai/sdk';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // 1. Read API Key
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error("Error: ALCHEMYST_AI_API_KEY environment variable is not set.");
    process.exit(1);
  }

  // 2. Read Run ID
  let runId = '';
  try {
    runId = fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
  } catch (err: any) {
    console.error("Error: Failed to read run-id from /logs/artifacts/run-id:", err.message);
    process.exit(1);
  }

  if (!runId) {
    console.error("Error: Run ID is empty.");
    process.exit(1);
  }

  // 3. Parse CLI Arguments
  const args = process.argv.slice(2);
  let group: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--group' && i + 1 < args.length) {
      group = args[i + 1];
      break;
    }
  }

  if (!group) {
    console.error("Error: --group <group_name> is required.");
    process.exit(1);
  }

  // 4. Initialize Alchemyst AI Client
  const client = new AlchemystAI({ apiKey });

  // 5. Define 4 Resource Documents to Seed
  const docsToSeed = [
    {
      file_name: `support_doc_1_${runId}`,
      group_name: ["support"],
      content: "Support document 1: How to reset your password. To reset your password, click on the forgot password link on the login page."
    },
    {
      file_name: `support_doc_2_${runId}`,
      group_name: ["support"],
      content: "Support document 2: Billing policy details. We bill on a monthly subscription basis. You can cancel your subscription at any time."
    },
    {
      file_name: `engineering_doc_1_${runId}`,
      group_name: ["engineering"],
      content: "Engineering document 1: Deploying to Kubernetes. We use Helm charts to deploy our microservices to Kubernetes clusters in production."
    },
    {
      file_name: `engineering_doc_2_${runId}`,
      group_name: ["engineering"],
      content: "Engineering document 2: Database migration guide. Run npm run db:migrate to apply the latest migrations to your PostgreSQL database."
    }
  ];

  // 6. Seed Documents Idempotently
  console.error(`Seeding 4 documents with run-id suffix: ${runId}...`);
  for (const doc of docsToSeed) {
    try {
      console.error(`Seeding document: ${doc.file_name} for group: ${doc.group_name.join(', ')}`);
      await client.v1.context.add({
        context_type: 'resource',
        source: 'docs',
        scope: 'internal',
        metadata: {
          fileName: doc.file_name,
          fileSize: Buffer.byteLength(doc.content),
          fileType: 'text/plain',
          lastModified: new Date().toISOString(),
          groupName: doc.group_name
        },
        documents: [
          {
            content: doc.content,
            metadata: {
              file_name: doc.file_name,
              group_name: doc.group_name
            } as any
          }
        ]
      });
      console.error(`Successfully seeded: ${doc.file_name}`);
    } catch (err: any) {
      if (err.status === 409 || err.statusCode === 409 || (err.message && err.message.includes('409'))) {
        console.error(`Document ${doc.file_name} already seeded (409 conflict).`);
      } else {
        console.error(`Failed to seed ${doc.file_name}:`, err);
        process.exit(1);
      }
    }
  }

  // 7. Perform Metadata-Filtered Context Search
  console.error(`Performing filtered search for group: ${group}...`);
  try {
    const searchRes = await client.v1.context.search({
      query: `${group} document`,
      scope: 'internal',
      minimum_similarity_threshold: 0.05,
      similarity_threshold: 0.05,
      metadata: 'true',
      body_metadata: { groupName: [group] } as any
    });

    // 8. Deduplicate and Print File Names as JSON Array on stdout
    const fileNames = new Set<string>();
    if (searchRes.contexts && Array.isArray(searchRes.contexts)) {
      for (const context of searchRes.contexts) {
        const meta = context.metadata as any;
        if (meta && meta.file_name) {
          fileNames.add(meta.file_name);
        }
      }
    }

    const output = Array.from(fileNames);
    console.log(JSON.stringify(output));
  } catch (err: any) {
    console.error("Search failed:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
