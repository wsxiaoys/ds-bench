'use client';

import { trpc } from './Provider';

export default function Home() {
  const { data, isLoading, error } = trpc.hello.useQuery('tRPC v11');

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            tRPC v11 Setup
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            This is a basic Next.js App Router project with tRPC v11 backend API.
          </p>
          <div id="result" className="mt-4 p-4 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
            {isLoading ? (
              <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
            ) : error ? (
              <p className="text-red-600 dark:text-red-400">Error: {error.message}</p>
            ) : (
              <p className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
                {data}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}