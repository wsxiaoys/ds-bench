"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";

export default function Home() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [streaming, setStreaming] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const message = input.trim();
    if (!message || streaming) return;

    setStreaming(true);
    setResponse("");

    try {
      // The `chat` procedure returns an AsyncGenerator that streams
      // characters over HTTP via `httpBatchStreamLink`.
      const stream = await trpc.chat.query(message);
      for await (const char of stream) {
        setResponse((prev) => prev + char);
      }
    } catch (err) {
      setResponse(
        (prev) => prev + `\n[Error: ${err instanceof Error ? err.message : String(err)}]`,
      );
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-8 py-16 px-6 sm:py-24">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50 sm:text-4xl">
            tRPC v11 Streaming Chat
          </h1>
          <p className="max-w-md text-base text-zinc-600 dark:text-zinc-400">
            Send a message and watch the response stream character by character
            over HTTP using <code className="font-mono">httpBatchStreamLink</code>.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col gap-3 sm:flex-row"
        >
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message to stream..."
            disabled={streaming}
            className="flex-1 rounded-lg border border-solid border-black/[.12] bg-white px-4 py-3 text-base text-black outline-none transition-colors focus:border-black dark:border-white/[.18] dark:bg-[#1a1a1a] dark:text-zinc-50 dark:focus:border-white disabled:opacity-60"
          />
          <button
            id="chat-submit"
            type="submit"
            disabled={streaming || !input.trim()}
            className="flex h-[52px] items-center justify-center rounded-lg bg-black px-6 text-base font-medium text-white transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-[#ccc] sm:w-[120px]"
          >
            {streaming ? "Streaming..." : "Send"}
          </button>
        </form>

        <div
          id="chat-response"
          className="w-full min-h-[160px] rounded-lg border border-solid border-black/[.12] bg-white p-5 text-base leading-7 text-black whitespace-pre-wrap break-words dark:border-white/[.18] dark:bg-[#1a1a1a] dark:text-zinc-50"
          aria-live="polite"
        >
          {response || (
            <span className="text-zinc-400 dark:text-zinc-500">
              The streamed response will appear here...
            </span>
          )}
          {streaming ? (
            <span className="ml-0.5 inline-block h-5 w-2 animate-pulse bg-current align-middle" />
          ) : null}
        </div>
      </main>
    </div>
  );
}