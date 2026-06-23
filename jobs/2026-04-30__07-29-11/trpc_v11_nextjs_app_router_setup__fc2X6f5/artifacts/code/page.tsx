"use client";

import { trpc } from "./Provider";

export default function Home() {
  const { data, isLoading, error } = trpc.hello.useQuery("tRPC v11");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-zinc-900">
        <h1 className="mb-4 text-2xl font-semibold">tRPC v11 Demo</h1>
        <div id="result" className="text-lg text-zinc-700 dark:text-zinc-200">
          {isLoading ? "Loading..." : error ? error.message : data}
        </div>
      </div>
    </main>
  );
}
