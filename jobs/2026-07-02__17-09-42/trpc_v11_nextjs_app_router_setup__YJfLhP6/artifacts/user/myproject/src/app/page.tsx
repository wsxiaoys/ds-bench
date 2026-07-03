'use client';

import { trpc } from './Provider';

export default function Home() {
  const { data, isLoading, error } = trpc.hello.useQuery('tRPC v11');

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div id="result" className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            {isLoading
              ? 'Loading...'
              : error
                ? `Error: ${error.message}`
                : (data ?? '')}
          </h1>
        </div>
      </main>
    </div>
  );
}