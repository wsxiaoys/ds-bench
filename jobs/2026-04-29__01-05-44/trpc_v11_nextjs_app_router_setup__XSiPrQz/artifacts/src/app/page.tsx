'use client';

import { trpc } from './trpc-client';

export default function Home() {
  const hello = trpc.hello.useQuery('tRPC v11');

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black text-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            tRPC v11 Setup
          </h1>
          <div id="result" className="text-xl font-bold">
            {hello.data ? hello.data : 'Loading...'}
          </div>
        </div>
      </main>
    </div>
  );
}
