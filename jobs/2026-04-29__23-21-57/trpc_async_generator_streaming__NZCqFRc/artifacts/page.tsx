"use client";

import { useState } from "react";
import { createTRPCClient } from "@trpc/client";
import { httpBatchStreamLink } from "@trpc/client";
import type { AppRouter } from "@/server/routers/app";

// Create tRPC client with httpBatchStreamLink for streaming support
const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: "/api/trpc",
    }),
  ],
});

export default function Home() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    setIsStreaming(true);
    setResponse("");

    try {
      // Call the chat procedure which returns an AsyncGenerator
      const stream = await client.chat.query(input);

      // Consume the stream and update the response as characters arrive
      for await (const char of stream) {
        setResponse((prev) => prev + char);
      }
    } catch (error) {
      console.error("Error streaming response:", error);
      setResponse("Error occurred while streaming response.");
    } finally {
      setIsStreaming(false);
      setInput("");
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black min-h-screen p-8">
      <main className="flex flex-col w-full max-w-3xl gap-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-4">
            tRPC v11 Streaming Chat
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Experience native streaming with AsyncGenerator and httpBatchStreamLink
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
          <form onSubmit={handleSubmit} className="flex gap-4 mb-6">
            <input
              id="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isStreaming}
              className="flex-1 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              id="chat-submit"
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isStreaming ? "Streaming..." : "Send"}
            </button>
          </form>

          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
            <h2 className="text-lg font-semibold text-black dark:text-zinc-50 mb-3">
              Response
            </h2>
            <div
              id="chat-response"
              className="min-h-[100px] p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-black dark:text-zinc-50 whitespace-pre-wrap"
            >
              {response || (
                <span className="text-zinc-500 dark:text-zinc-400">
                  Your streamed response will appear here...
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            Powered by tRPC v11 • AsyncGenerator • httpBatchStreamLink
          </p>
        </div>
      </main>
    </div>
  );
}