"use client";

import { useEffect, useState } from "react";
import { trpc } from "./_trpc/client";

export default function Home() {
  const [numbers, setNumbers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const iterable = await utils.client.streamNumbers.query();
        for await (const value of iterable) {
          if (cancelled) return;
          setNumbers((prev) => [...prev, value]);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [utils.client]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          tRPC Streaming Demo
        </h1>
        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Streamed numbers:
          </p>
          <div
            id="stream-output"
            data-testid="stream-output"
            className="rounded-md bg-zinc-100 dark:bg-zinc-900 px-6 py-4 text-2xl font-mono text-black dark:text-zinc-50"
          >
            {error ? `Error: ${error}` : numbers.join(", ")}
          </div>
        </div>
      </main>
    </div>
  );
}
