'use client';

import { trpc } from './trpc';

export default function Home() {
  const hello = trpc.hello.useQuery('tRPC v11');

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <div id="result" className="text-3xl font-semibold text-black dark:text-zinc-50">
          {hello.isLoading ? 'Loading...' : hello.data}
        </div>
      </main>
    </div>
  );
}
