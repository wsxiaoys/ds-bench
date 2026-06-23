import { AlchemystAI } from '@alchemystai/sdk';
import * as process from 'process';

async function main() {
  const args = process.argv.slice(2);
  let userId = '';
  let addContent = '';
  let queryContent = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--user-id') {
      userId = args[++i];
    } else if (args[i] === '--add') {
      addContent = args[++i];
    } else if (args[i] === '--query') {
      queryContent = args[++i];
    }
  }

  if (!userId) {
    console.error('Error: MISSING_PARAMETERS - userId is required.');
    process.exit(1);
  }

  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    console.error('Error: MISSING_PARAMETERS - ZEALT_RUN_ID environment variable is missing.');
    process.exit(1);
  }

  const sessionId = `team-standup-${runId}`;

  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error('Error: ALCHEMYST_AI_API_KEY environment variable is missing.');
    process.exit(1);
  }

  const client = new AlchemystAI({ apiKey });

  // Patch missing search method if needed
  const memoryApi = client.v1.context.memory as any;
  if (typeof memoryApi.search !== 'function') {
    memoryApi.search = function(body: any, options?: any) {
      // Fallback to the main context search if memory.search is missing in the SDK
      return client.v1.context.search(body, options);
    };
  }

  if (addContent) {
    try {
      await memoryApi.add({
        userId,
        sessionId,
        content: addContent,
        contents: [{ content: addContent, metadata: { messageId: Date.now().toString(), userId } }]
      });
      console.log(`ADDED: ${addContent}`);
    } catch (error: any) {
      console.error('Failed to add memory:', error?.message || error);
      process.exit(1);
    }
  } else if (queryContent) {
    try {
      const result = await memoryApi.search({
        userId,
        sessionId,
        query: queryContent,
        similarity_threshold: 0.1,
        minimum_similarity_threshold: 0.1
      });
      
      const memories = Array.isArray(result) ? result : (result.memories || result.results || result.contexts || []);
      
      for (const mem of memories) {
        const text = mem.content || mem.text || mem.memory || JSON.stringify(mem);
        console.log(`MEMORY: ${text}`);
      }
    } catch (error: any) {
      console.error('Failed to search memory:', error?.message || error);
      process.exit(1);
    }
  } else {
    console.error('Error: Must specify either --add or --query.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
