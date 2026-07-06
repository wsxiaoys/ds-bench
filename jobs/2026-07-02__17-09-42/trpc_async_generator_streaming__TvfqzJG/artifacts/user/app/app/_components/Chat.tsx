"use client";

import { useEffect, useRef, useState } from "react";
import { trpc } from "./TRPCProvider";

export function Chat() {
  const [input, setInput] = useState("");
  const [streamedResponse, setStreamedResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hold a reference to the in-flight iterator so we can cancel it
  // when the user submits a new message before the previous one finishes.
  const cancelRef = useRef<(() => void) | null>(null);

  // Cleanup any in-flight stream when the component unmounts.
  useEffect(() => {
    return () => {
      cancelRef.current?.();
    };
  }, []);

  async function streamChat(message: string) {
    // Cancel any previous in-flight stream first.
    cancelRef.current?.();

    let cancelled = false;
    cancelRef.current = () => {
      cancelled = true;
    };

    setStreamedResponse("");
    setError(null);
    setIsStreaming(true);

    try {
      // Direct call through the underlying tRPC client — this returns an
      // AsyncIterable<string> backed by the httpBatchStreamLink HTTP stream.
      const iterable = await trpc.useUtils().client.chat.query(message);
      let accumulated = "";
      for await (const chunk of iterable as unknown as AsyncIterable<string>) {
        if (cancelled) return;
        accumulated += chunk;
        setStreamedResponse(accumulated);
      }
    } catch (err) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!cancelled) {
        setIsStreaming(false);
        cancelRef.current = null;
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    void streamChat(trimmed);
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          disabled={isStreaming}
        />
        <button
          id="chat-submit"
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          disabled={isStreaming || input.trim().length === 0}
        >
          {isStreaming ? "Streaming..." : "Send"}
        </button>
      </form>

      <div
        id="chat-response"
        className="min-h-[6rem] rounded-md border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm whitespace-pre-wrap text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      >
        {error ? (
          <span className="text-red-500">Error: {error}</span>
        ) : streamedResponse ? (
          streamedResponse
        ) : (
          <span className="text-zinc-400">
            The streamed response will appear here.
          </span>
        )}
      </div>
    </div>
  );
}