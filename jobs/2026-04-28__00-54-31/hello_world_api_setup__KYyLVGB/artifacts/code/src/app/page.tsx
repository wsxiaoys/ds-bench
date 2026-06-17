'use client';

import { trpc } from '@/utils/trpc';

export default function Home() {
  const hello = trpc.hello.useQuery('World');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-6xl font-bold">
          tRPC v11 + Next.js App Router
        </h1>

        <div className="mt-8 text-2xl">
          {hello.data ? (
            <p>{hello.data}</p>
          ) : (
            <p>Loading...</p>
          )}
        </div>
      </main>
    </div>
  );
}
