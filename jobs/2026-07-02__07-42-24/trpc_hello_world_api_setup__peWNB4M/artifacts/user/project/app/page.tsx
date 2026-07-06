'use client';

import { trpc } from '@/utils/trpc';

export default function Home() {
  const helloQuery = trpc.hello.useQuery('World');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col gap-6">
        <h1 className="text-4xl font-bold tracking-tight">tRPC v11 + Next.js App Router</h1>
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-md border border-zinc-200 dark:border-zinc-800 w-full max-w-md text-center">
          <p className="text-zinc-500 dark:text-zinc-400 mb-2">Querying `hello` with input <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">&quot;World&quot;</code>:</p>
          {helloQuery.isLoading ? (
            <p className="text-lg font-medium text-amber-500 animate-pulse">Loading...</p>
          ) : helloQuery.isError ? (
            <p className="text-lg font-medium text-red-500">Error: {helloQuery.error.message}</p>
          ) : (
            <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
              {helloQuery.data}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
