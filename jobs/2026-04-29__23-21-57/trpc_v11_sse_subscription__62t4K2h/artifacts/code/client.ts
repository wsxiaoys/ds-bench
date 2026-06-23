import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import { EventSource } from 'eventsource';
import * as fs from 'fs';
import * as path from 'path';

// Define the router type inline
interface AppRouter {
  countdown: {
    _def: {
      _output_in: number;
    };
  };
}

// Create tRPC client with SSE subscription support
const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000/trpc',
      EventSource: EventSource as any,
    }),
  ],
});

// Collect countdown numbers
const countdownNumbers: number[] = [];

async function runClient() {
  try {
    console.log('Starting countdown subscription...');
    
    // Subscribe to the countdown
    const subscription = client.countdown.subscribe(undefined, {
      onData(data) {
        console.log('Received:', data);
        countdownNumbers.push(data);
      },
      onError(err) {
        console.error('Subscription error:', err);
        process.exit(1);
      },
      onComplete() {
        console.log('Subscription completed');
        console.log('Collected numbers:', countdownNumbers);
        
        // Save to output.json
        const outputPath = path.join(process.cwd(), 'output.json');
        fs.writeFileSync(outputPath, JSON.stringify(countdownNumbers, null, 2));
        console.log('Saved to:', outputPath);
        
        // Exit process
        process.exit(0);
      },
    });
  } catch (error) {
    console.error('Client error:', error);
    process.exit(1);
  }
}

// Run the client
runClient();