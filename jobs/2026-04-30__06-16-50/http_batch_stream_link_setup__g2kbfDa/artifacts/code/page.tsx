'use client';
import { trpc } from '@/trpc/client';
export default function Home() {
  const hello = trpc.hello.useQuery('tRPC');
  const chatStream = trpc.chatStream.useQuery('Hello, World!');
  return (
    <main className="p-4">
      <h1>tRPC AI Streaming Chat</h1>
      <p>Status: {hello.data ? hello.data : 'Loading...'}</p>
      <p>Stream: {chatStream.data ? (chatStream.data as string[]).join('') : 'Loading...'}</p>
    </main>
  );
}
