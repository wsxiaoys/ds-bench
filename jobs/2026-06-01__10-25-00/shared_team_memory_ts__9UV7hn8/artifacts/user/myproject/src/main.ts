import AlchemystAI from '@alchemystai/sdk';
import { Memory } from '@alchemystai/sdk/resources/v1/context/memory';

// Monkeypatch client.v1.context.memory.search to support the search method
(Memory.prototype as any).search = async function (
  this: any,
  params: {
    userId?: string;
    user_id?: string;
    sessionId?: string;
    session_id?: string;
    query?: string;
    similarityThreshold?: number;
    minimumSimilarityThreshold?: number;
    similarity_threshold?: number;
    minimum_similarity_threshold?: number;
  },
  options?: any
) {
  const query = params.query || '';
  const userId = params.userId ?? params.user_id;
  const sessionId = params.sessionId ?? params.session_id;
  const similarityThreshold = params.similarityThreshold ?? params.similarity_threshold ?? 0.1;
  const minimumSimilarityThreshold = params.minimumSimilarityThreshold ?? params.minimum_similarity_threshold ?? 0.1;

  const searchRes = await this._client.post('/api/v1/context/search', {
    body: {
      query,
      similarity_threshold: similarityThreshold,
      minimum_similarity_threshold: minimumSimilarityThreshold,
      user_id: userId,
      session_id: sessionId,
    },
    ...options
  });

  const contexts = searchRes.contexts || [];
  const memories = contexts.map((ctx: any) => ({
    content: ctx.content,
    ...ctx
  }));

  return {
    ...searchRes,
    contexts,
    memories
  };
};

async function main() {
  // Parse command line arguments
  let userId: string | undefined = undefined;
  let addContent: string | undefined = undefined;
  let queryText: string | undefined = undefined;

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--user-id') {
      userId = process.argv[++i];
    } else if (arg.startsWith('--user-id=')) {
      userId = arg.slice('--user-id='.length);
    } else if (arg === '--add') {
      addContent = process.argv[++i];
    } else if (arg.startsWith('--add=')) {
      addContent = arg.slice('--add='.length);
    } else if (arg === '--query') {
      queryText = process.argv[++i];
    } else if (arg.startsWith('--query=')) {
      queryText = arg.slice('--query='.length);
    }
  }

  // Validate presence of --user-id
  if (!userId) {
    const msg = 'Error: MISSING_PARAMETERS - The --user-id parameter is required for all memory operations.';
    console.log(msg);
    console.error(msg);
    process.exit(1);
  }

  // Get ZEALT_RUN_ID to derive sessionId
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    const msg = 'Error: MISSING_PARAMETERS - ZEALT_RUN_ID environment variable is missing, which is required to derive the sessionId.';
    console.log(msg);
    console.error(msg);
    process.exit(1);
  }

  const sessionId = `team-standup-${runId}`;

  // Get API Key
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error('Error: ALCHEMYST_AI_API_KEY environment variable is not set.');
    process.exit(1);
  }

  // Initialize Alchemyst client
  const client = new AlchemystAI({ apiKey });

  if (addContent !== undefined) {
    try {
      await client.v1.context.memory.add({
        sessionId,
        contents: [
          {
            content: addContent,
            user_id: userId,
            userId: userId,
          }
        ],
        user_id: userId,
        userId: userId,
      } as any);

      console.log(`ADDED: ${addContent}`);
      process.exit(0);
    } catch (err: any) {
      console.error('Error adding memory:', err.message || err);
      process.exit(1);
    }
  } else if (queryText !== undefined) {
    try {
      // Retrieve memories using client.v1.context.memory.search
      const searchRes = await (client.v1.context.memory as any).search({
        userId,
        sessionId,
        query: queryText,
        similarityThreshold: 0.1,
        minimumSimilarityThreshold: 0.1,
      });

      const memories = searchRes.memories || [];
      for (const memory of memories) {
        if (memory && typeof memory.content === 'string') {
          console.log(`MEMORY: ${memory.content}`);
        }
      }
      process.exit(0);
    } catch (err: any) {
      console.error('Error searching memory:', err.message || err);
      process.exit(1);
    }
  } else {
    console.error('Error: Either --add or --query must be specified.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error in main:', err);
  process.exit(1);
});
