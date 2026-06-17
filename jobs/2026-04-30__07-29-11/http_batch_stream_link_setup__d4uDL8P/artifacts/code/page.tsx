'use client';

import { useEffect, useState } from 'react';

import { trpc } from '@/trpc/client';

export default function Home() {
  const [message, setMessage] = useState('');
  const chatStream = trpc.chatStream.useQuery('Say hello to the user');

  useEffect(() => {
    const stream = chatStream.data as AsyncIterable<string> | undefined;

    if (!stream) {
      return;
    }

    let cancelled = false;
    setMessage('');

    const readStream = async () => {
      for await (const chunk of stream) {
        if (cancelled) {
          break;
        }

        setMessage((current) => current + chunk);
      }
    };

    void readStream();

    return () => {
      cancelled = true;
    };
  }, [chatStream.data]);

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">tRPC AI Streaming Chat</h1>
      <p>Prompt: Say hello to the user</p>
      <p>Status: {chatStream.isLoading ? 'Streaming...' : 'Complete'}</p>
      <p>Response: {message || 'Waiting for stream...'}</p>
    </main>
  );
}
