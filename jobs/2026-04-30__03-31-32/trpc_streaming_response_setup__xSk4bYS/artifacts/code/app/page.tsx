'use client';

import { useEffect, useState } from 'react';
import { trpcClient } from '../lib/trpc/client';

export default function Home() {
  const [words, setWords] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function stream() {
      const result = await trpcClient.streamWords.query();

      // tRPC v11 async generator procedures return an AsyncIterable
      if (
        result != null &&
        typeof (result as unknown as AsyncIterable<string>)[Symbol.asyncIterator] === 'function'
      ) {
        const iterable = result as unknown as AsyncIterable<string>;
        for await (const word of iterable) {
          if (cancelled) break;
          setWords((prev) => [...prev, word]);
        }
      } else {
        // Fallback: result is a plain value
        setWords([String(result)]);
      }

      if (!cancelled) setDone(true);
    }

    stream().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>tRPC v11 Streaming Demo</h1>
      <p style={{ fontSize: '1.5rem' }}>
        {words.length > 0 ? words.join(' ') : 'Waiting for stream\u2026'}
      </p>
      {done && <p style={{ color: 'green' }}>Stream complete \u2713</p>}
    </main>
  );
}
