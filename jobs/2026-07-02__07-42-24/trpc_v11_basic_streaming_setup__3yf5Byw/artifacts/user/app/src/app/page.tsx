'use client';

import { trpc } from '@/trpc/client';

export default function Home() {
  const { data } = trpc.streamNumbers.useQuery();

  const output = data ? data.join(', ') : '';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-4">
      <main className="w-full max-w-md p-6 bg-white rounded-xl shadow-md space-y-4">
        <h1 className="text-2xl font-bold text-center">tRPC v11 Streaming</h1>
        <div className="p-4 bg-zinc-100 rounded-lg text-center font-mono">
          <div id="stream-output">{output}</div>
        </div>
      </main>
    </div>
  );
}
