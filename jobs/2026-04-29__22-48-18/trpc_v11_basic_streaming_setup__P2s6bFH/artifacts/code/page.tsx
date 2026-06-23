'use client';

import { trpc } from '@/trpc/client';

export default function Home() {
  const { data, isLoading } = trpc.streamNumbers.useQuery();

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-24">
      <h1 className="text-2xl mb-4">tRPC Streaming Output</h1>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div id="stream-output">{Array.isArray(data) ? data.join(', ') : data}</div>
      )}
    </div>
  );
}
