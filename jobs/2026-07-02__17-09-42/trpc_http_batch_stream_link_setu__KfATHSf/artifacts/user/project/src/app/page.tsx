'use client';
import { useEffect, useState } from 'react';
import { trpc } from '@/trpc/client';
export default function Home() {
  const [text, setText] = useState('');

  useEffect(() => {
    let cancelled = false;
    let accumulated = '';

    (async () => {
      const iterable = await trpc.chatStream.query('Hello');
      for await (const chunk of iterable) {
        if (cancelled) break;
        accumulated += chunk;
        setText(accumulated);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="p-4">
      <h1>tRPC AI Streaming Chat</h1>
      <p>Status: {text || 'Loading...'}</p>
    </main>
  );
}
