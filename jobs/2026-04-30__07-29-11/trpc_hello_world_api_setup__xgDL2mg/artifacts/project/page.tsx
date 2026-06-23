"use client";

import { trpc } from "@/utils/trpc";

export default function Home() {
  const { data, isLoading, error } = trpc.hello.useQuery("World");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-50">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-10 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">tRPC v11</p>
        <h1 className="mt-3 text-4xl font-semibold">Hello World API</h1>
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/70 p-6">
          <p className="text-sm text-zinc-400">Query: hello(\"World\")</p>
          <p className="mt-3 text-2xl font-medium">
            {isLoading && "Loading..."}
            {error && `Error: ${error.message}`}
            {data && data}
          </p>
        </div>
      </div>
    </main>
  );
}
