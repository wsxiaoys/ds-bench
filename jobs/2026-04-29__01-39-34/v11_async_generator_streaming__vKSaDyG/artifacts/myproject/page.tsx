"use client";

import { useState } from "react";

import { trpcClient } from "@/trpc/client";

const defaultPrompt =
  "Build a streaming demo with tRPC v11 and Next.js so every chunk arrives in real time.";

export default function Home() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [chunks, setChunks] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startStream = async () => {
    setChunks([]);
    setError(null);
    setIsStreaming(true);

    try {
      const stream = await trpcClient.chatStream.query(prompt);
      for await (const chunk of stream) {
        setChunks((prev) => [...prev, chunk]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Streaming failed.");
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16 text-zinc-900">
      <main className="flex w-full max-w-3xl flex-col gap-8 rounded-3xl bg-white p-10 shadow-lg">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
            tRPC v11 Async Streaming
          </p>
          <h1 className="text-3xl font-semibold">
            Stream responses with httpBatchStreamLink
          </h1>
          <p className="text-base text-zinc-600">
            Enter a prompt and watch chunks arrive in real time from the chatStream
            AsyncGenerator.
          </p>
        </header>

        <section className="space-y-4">
          <label className="text-sm font-medium text-zinc-700" htmlFor="prompt">
            Prompt
          </label>
          <textarea
            id="prompt"
            className="min-h-[120px] w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <button
            type="button"
            className="w-full rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            onClick={startStream}
            disabled={isStreaming || prompt.trim().length === 0}
          >
            {isStreaming ? "Streaming..." : "Start streaming"}
          </button>
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700">Streamed output</h2>
            <span className="text-xs text-zinc-500">
              {chunks.length} chunk{chunks.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-4 min-h-[120px] whitespace-pre-wrap text-sm text-zinc-800">
            {chunks.length === 0
              ? "Chunks will appear here as they arrive."
              : chunks.join("")}
          </div>
        </section>
      </main>
    </div>
  );
}
