'use client';
import { trpc } from '@/trpc/client';
import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('Test prompt');
  const chatStream = trpc.chatStream.useQuery(prompt);
  
  return (
    <main className="p-4">
      <h1>tRPC AI Streaming Chat</h1>
      <p>Status: {chatStream.status}</p>
      <div>
        {chatStream.data ? (
          Array.isArray(chatStream.data) ? chatStream.data.join('') : chatStream.data
        ) : 'Loading...'}
      </div>
    </main>
  );
}
