"use client";

import { useState, useRef } from "react";
import { trpcClient } from "@/lib/trpc";

export default function Home() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    // Cancel any in-flight stream
    if (abortRef.current) {
      abortRef.current();
    }

    setResponse("");
    setIsStreaming(true);

    let cancelled = false;
    abortRef.current = () => {
      cancelled = true;
    };

    try {
      const stream = await trpcClient.chat.query(input);

      for await (const chunk of stream) {
        if (cancelled) break;
        setResponse((prev) => prev + chunk);
      }
    } catch (err) {
      if (!cancelled) {
        console.error("Stream error:", err);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-800 rounded-2xl shadow-lg p-8 flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
          tRPC v11 Streaming Chat
        </h1>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            disabled={isStreaming}
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 px-4 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            id="chat-submit"
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isStreaming ? "Streaming…" : "Send"}
          </button>
        </form>

        <div
          id="chat-response"
          className="min-h-[120px] rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 p-4 font-mono text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap break-words"
        >
          {response || (
            <span className="text-zinc-400 dark:text-zinc-500 italic">
              Response will appear here…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
