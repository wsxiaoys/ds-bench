"use client";

import { trpc } from "@/utils/trpc";

export default function Home() {
  const { data, isLoading, error } = trpc.hello.useQuery("World");

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            tRPC v11 Hello World
          </h1>
          {isLoading && <p className="text-lg text-zinc-600 dark:text-zinc-400">Loading...</p>}
          {error && <p className="text-lg text-red-600">Error: {error.message}</p>}
          {data && (
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              {data}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}