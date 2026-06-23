'use client';
import { trpc } from '@/trpc/client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [message, setMessage] = useState('');
  const chatStream = trpc.chatStream.useQuery('Say hello', {
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!chatStream.data) {
      return;
    }

    let cancelled = false;
    setMessage('');

    const consume = async () => {
      let buffer = '';
      for await (const chunk of chatStream.data) {
        if (cancelled) {
          return;
        }
        buffer += chunk;
        setMessage(buffer);
      }
    };

    void consume();
    return () => {
      cancelled = true;
    };
  }, [chatStream.data]);

  return (
    <main className="p-4">
      <h1>tRPC AI Streaming Chat</h1>
      <p>Response: {message || 'Loading...'}</p>
    </main>
  );
}
