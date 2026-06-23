"use client";

import { useEffect, useState } from "react";
import { createTRPCProxyClient, httpBatchStreamLink } from "@trpc/client";
import type { AppRouter } from "@/server/router";

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: "/api/trpc",
    }),
  ],
});

export default function Home() {
  const [words, setWords] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const iterable = (await client.streamWords.query()) as unknown as AsyncIterable<string>;
        for await (const word of iterable) {
          if (cancelled) return;
          setWords((prev) => [...prev, word]);
        }
        if (!cancelled) setDone(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>tRPC v11 Streaming Demo</h1>
      {error ? (
        <p style={{ color: "red" }}>Error: {error}</p>
      ) : (
        <p data-testid="streamed-text" style={{ fontSize: "1.5rem" }}>
          {words.join(" ")}
        </p>
      )}
      <p>{done ? "(stream complete)" : "(streaming...)"}</p>
    </main>
  );
}
