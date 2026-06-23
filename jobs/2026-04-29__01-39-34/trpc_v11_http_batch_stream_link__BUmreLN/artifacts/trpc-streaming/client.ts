import { appendFile } from 'node:fs/promises';
import { createTRPCProxyClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from './server.js';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: 'http://localhost:3000/trpc',
    }),
  ],
});

const logPath = new URL('./client.log', import.meta.url);

async function logMessage(message: string) {
  console.log(message);
  await appendFile(logPath, `${message}\n`, { encoding: 'utf8' });
}

async function run() {
  const stream = await client.chatStream.query();

  for await (const chunk of stream) {
    await logMessage(chunk);
  }
}

run().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await logMessage(`Error: ${message}`);
  process.exitCode = 1;
});
