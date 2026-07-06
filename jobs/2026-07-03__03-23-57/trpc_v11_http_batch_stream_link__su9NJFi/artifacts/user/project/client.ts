import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from './server.js';
import * as fs from 'fs';

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  const logPath = '/home/user/project/client.log';
  // Ensure log file is empty/created
  fs.writeFileSync(logPath, '');

  try {
    const stream = await client.chatStream.query();
    for await (const chunk of stream) {
      console.log(chunk);
      fs.appendFileSync(logPath, chunk + '\n');
    }
  } catch (error) {
    console.error('Error during streaming:', error);
  }
}

main();
