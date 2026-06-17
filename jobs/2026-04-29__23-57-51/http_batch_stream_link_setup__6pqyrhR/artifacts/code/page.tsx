'use client';
import { trpc } from '@/trpc/client';

function ChatStream() {
  const streamQuery = trpc.chatStream.useQuery('Hello AI');

  if (streamQuery.isLoading && !streamQuery.data) {
    return <p>Loading...</p>;
  }

  if (streamQuery.error) {
    return <p>Error: {streamQuery.error.message}</p>;
  }

  // tRPC v11 with httpBatchStreamLink + async generator:
  // data is progressively updated as an array of yielded chunks
  const chunks = (streamQuery.data as unknown as string[]) ?? [];
  const text = chunks.join('');

  return <p id="stream-output">{text || 'Waiting for stream...'}</p>;
}

export default function Home() {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">tRPC AI Streaming Chat</h1>
      <ChatStream />
    </main>
  );
}
