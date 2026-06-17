'use client';

import { trpc } from '@/utils/trpc';
import { useState, useEffect } from 'react';

export default function Home() {
  const [words, setWords] = useState<string[]>([]);
  const trpcContext = trpc.useUtils();

  useEffect(() => {
    let active = true;
    
    async function fetchStream() {
      try {
        const iterable = await trpcContext.client.streamWords.query();
        // @ts-ignore - in case TypeScript doesn't know it's an AsyncIterable
        for await (const word of iterable) {
          if (!active) break;
          setWords((prev) => [...prev, word]);
        }
      } catch (err) {
        console.error(err);
      }
    }
    
    fetchStream();
    
    return () => {
      active = false;
    };
  }, [trpcContext.client.streamWords]);

  return (
    <div className="p-8 font-sans">
      <h1 className="text-2xl font-bold">{words.join(' ')}</h1>
    </div>
  );
}
