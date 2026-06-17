'use client';

import { trpc } from './Provider';

export default function Home() {
  const { data, isLoading, error } = trpc.hello.useQuery('tRPC v11');

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          tRPC v11 + Next.js App Router
        </h1>
        <div id="result" className="mt-6 text-xl text-zinc-600 dark:text-zinc-400">
          {isLoading ? 'Loading...' : error ? `Error: ${error.message}` : data}
        </div>
      </main>
    </div>
  );
}