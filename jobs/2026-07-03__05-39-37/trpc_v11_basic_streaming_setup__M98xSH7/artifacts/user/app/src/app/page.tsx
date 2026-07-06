"use client";

import { Suspense } from "react";
import { trpc } from "@/trpc/react";

function StreamNumbers() {
  const [query] = trpc.streamNumbers.useSuspenseQuery();

  const numbers = (query ?? []) as number[];

  return (
    <div
      id="stream-output"
      className="mt-4 text-lg text-zinc-600 dark:text-zinc-400"
    >
      {numbers.join(", ")}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          tRPC Streaming
        </h1>
        <Suspense fallback={<div className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">Loading...</div>}>
          <StreamNumbers />
        </Suspense>
      </main>
    </div>
  );
}