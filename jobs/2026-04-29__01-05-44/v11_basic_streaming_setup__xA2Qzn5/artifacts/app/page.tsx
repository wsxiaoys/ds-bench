'use client';

import { trpc } from '@/trpc/client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [numbers, setNumbers] = useState<number[]>([]);
  const { data: stream } = trpc.streamNumbers.useQuery();

  useEffect(() => {
    if (!stream) return;
    let cancelled = false;

    const consume = async () => {
      for await (const value of stream) {
        if (cancelled) break;
        setNumbers((prev) => [...prev, value]);
      }
    };
    consume();

    return () => {
      cancelled = true;
    };
  }, [stream]);

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">tRPC Streaming Numbers</h1>
      <div id="stream-output" className="p-2 border rounded bg-gray-50">
        {numbers.join(', ')}
      </div>
    </main>
  );
}
