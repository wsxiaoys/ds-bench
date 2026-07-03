import AlchemystAI from '@alchemystai/sdk';
import * as fs from 'fs';
import * as path from 'path';

// Monkeypatch the SDK client prototype/instance to support the custom memory methods expected by the prompt
function patchAlchemystClient(client: AlchemystAI) {
  const memoryObj = client.v1.context.memory as any;
  if (!memoryObj) {
    return;
  }

  const memoryProto = Object.getPrototypeOf(memoryObj);
  const originalAdd = memoryProto.add;

  // Custom add method supporting both native and custom signatures
  memoryProto.add = async function (this: any, params: any, options?: any) {
    if (params && typeof params === 'object' && 'userId' in params && 'sessionId' in params && 'content' in params) {
      const { userId, sessionId, content } = params;
      if (!userId || !sessionId) {
        throw new Error('MISSING_PARAMETERS: Both userId and sessionId are required');
      }

      return client.v1.context.add({
        context_type: 'conversation',
        documents: [{ content }],
        scope: 'internal',
        source: 'cli-shared-memory',
        metadata: {
          groupName: [sessionId, userId]
        }
      });
    }

    if (originalAdd) {
      return originalAdd.call(this, params, options);
    }
  };

  // Custom search method
  memoryProto.search = async function (this: any, params: any, options?: any) {
    if (!params || typeof params !== 'object') {
      throw new Error('MISSING_PARAMETERS: Parameters object is required');
    }
    const { userId, sessionId, query } = params;
    if (!userId || !sessionId) {
      throw new Error('MISSING_PARAMETERS: Both userId and sessionId are required');
    }

    // Call the underlying context search API
    // We use a lenient similarity threshold (e.g. 0.1) as requested
    const response = await client.v1.context.search({
      query: query || '',
      similarity_threshold: 0.1,
      minimum_similarity_threshold: 0.1,
      scope: 'internal',
      body_metadata: {
        // Filter by sessionId only so that any user can recall memories added by other users in the same session!
        group_name: [sessionId]
      }
    });

    const contexts = response.contexts || [];
    const memories = contexts.map((ctx: any) => ({
      content: ctx.content || '',
      score: ctx.score
    }));

    return {
      memories,
      contexts
    };
  };
}

async function main() {
  // Parse command line arguments
  let userId: string | undefined;
  let addContent: string | undefined;
  let queryContent: string | undefined;

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--user-id=')) {
      userId = arg.slice('--user-id='.length);
    } else if (arg === '--user-id') {
      userId = process.argv[i + 1];
      i++;
    } else if (arg.startsWith('--add=')) {
      addContent = arg.slice('--add='.length);
    } else if (arg === '--add') {
      addContent = process.argv[i + 1];
      i++;
    } else if (arg.startsWith('--query=')) {
      queryContent = arg.slice('--query='.length);
    } else if (arg === '--query') {
      queryContent = process.argv[i + 1];
      i++;
    }
  }

  // Validate userId (must fail with MISSING_PARAMETERS if missing)
  if (!userId) {
    console.error('Error: MISSING_PARAMETERS - userId is required.');
    process.exit(1);
  }

  // Derive sessionId from /logs/artifacts/run-id
  let runId = '';
  try {
    if (fs.existsSync('/logs/artifacts/run-id')) {
      runId = fs.readFileSync('/logs/artifacts/run-id', 'utf-8').trim();
    }
  } catch (e) {
    // ignore
  }
  if (!runId) {
    runId = process.env.RUN_ID || '';
  }

  // Validate sessionId (must fail with MISSING_PARAMETERS if missing)
  if (!runId) {
    console.error('Error: MISSING_PARAMETERS - sessionId is required.');
    process.exit(1);
  }

  const sessionId = `team-standup-${runId}`;

  // Check if exactly one operation is provided
  if (addContent === undefined && queryContent === undefined) {
    console.error('Error: Either --add or --query must be provided.');
    process.exit(1);
  }
  if (addContent !== undefined && queryContent !== undefined) {
    console.error('Error: Cannot provide both --add and --query.');
    process.exit(1);
  }

  // Authenticate with ALCHEMYST_AI_API_KEY from environment
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error('Error: ALCHEMYST_AI_API_KEY is not set in the environment.');
    process.exit(1);
  }

  const client = new AlchemystAI({ apiKey });
  patchAlchemystClient(client);

  const memoryObj = client.v1.context.memory as any;

  if (addContent !== undefined) {
    try {
      await memoryObj.add({ userId, sessionId, content: addContent });
      console.log(`ADDED: ${addContent}`);
    } catch (error: any) {
      console.error('Error adding memory:', error.message || error);
      process.exit(1);
    }
  } else if (queryContent !== undefined) {
    try {
      const result = await memoryObj.search({ userId, sessionId, query: queryContent });
      const memories = result.memories || [];
      for (const mem of memories) {
        console.log(`MEMORY: ${mem.content}`);
      }
    } catch (error: any) {
      console.error('Error querying memory:', error.message || error);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
