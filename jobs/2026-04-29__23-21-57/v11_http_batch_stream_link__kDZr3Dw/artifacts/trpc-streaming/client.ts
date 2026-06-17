import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from './server';

// Create tRPC client with httpBatchStreamLink
const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  console.log('Connecting to tRPC server...');

  // Call the streaming procedure
  const stream = await client.chatStream.query();

  console.log('Starting to consume stream...');

  // Consume the AsyncGenerator and log each chunk
  for await (const chunk of stream) {
    console.log('Received chunk:', chunk);
  }

  console.log('Stream completed!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});