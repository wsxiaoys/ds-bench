'use client';

import { useEffect, useState } from 'react';
import { trpcRawClient } from '@/trpc/client';

export default function Home() {
  const [words, setWords] = useState<string[]>([]);

  useEffect(() => {
    async function stream() {
      const iterable = await trpcRawClient.streamWords.query();
      for await (const word of iterable) {
        setWords((prev) => [...prev, word]);
      }
    }
    stream();
  }, []);

  return (
    <main>
      <h1>tRPC Streaming Demo</h1>
      <div id="chat-output">{words.join(' ')}</div>
    </main>
  );
}