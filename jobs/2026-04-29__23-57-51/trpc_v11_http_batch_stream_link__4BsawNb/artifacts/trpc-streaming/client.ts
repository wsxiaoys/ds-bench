import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from './server';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Create a tRPC client using httpBatchStreamLink for streaming support.
 * httpBatchStreamLink enables the client to receive streamed query responses
 * that return AsyncGenerators from the server.
 */
const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: 'http://localhost:3000',
    }),
  ],
});

const LOG_FILE = path.join(__dirname, 'client.log');

async function main() {
  const logLines: string[] = [];

  function log(message: string) {
    console.log(message);
    logLines.push(message);
  }

  log('Connecting to tRPC server...');
  log('Calling chatStream procedure...');

  try {
    // chatStream returns Promise<AsyncIterable<string>> when the server
    // procedure returns an AsyncGenerator via httpBatchStreamLink
    const stream = await client.chatStream.query();

    log('Stream started, receiving chunks:');

    for await (const chunk of stream) {
      log(`Received chunk: ${chunk}`);
    }

    log('Stream complete.');
  } catch (error) {
    const errMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
    log(errMsg);
    fs.writeFileSync(LOG_FILE, logLines.join('\n') + '\n');
    process.exit(1);
  }

  // Write all logged output to client.log
  fs.writeFileSync(LOG_FILE, logLines.join('\n') + '\n');
  log(`Output saved to ${LOG_FILE}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
