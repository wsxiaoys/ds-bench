'use client';

import { trpc } from '@/trpc/client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [words, setWords] = useState<string[]>([]);

  // tRPC v11: useQuery on an async iterable procedure will update `data` as it streams.
  const { data } = trpc.streamWords.useQuery();

  useEffect(() => {
    if (typeof data === 'string') {
      setWords((prev) => {
        if (prev[prev.length - 1] !== data) {
          return [...prev, data];
        }
        return prev;
      });
    }
  }, [data]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-2xl font-bold">
        {words.join(' ')}
      </div>
    </main>
  );
}
