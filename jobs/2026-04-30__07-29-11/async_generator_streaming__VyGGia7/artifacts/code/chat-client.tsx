"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchStreamLink,
  isNonJsonSerializable,
  splitLink,
} from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";

import type { AppRouter } from "@/server/routers/app";

const queryClient = new QueryClient();

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition(op) {
        return isNonJsonSerializable(op.input);
      },
      true: httpBatchStreamLink({
        transformer: superjson,
        url: getBaseUrl() + "/api/trpc",
      }),
      false: httpBatchStreamLink({
        transformer: superjson,
        url: getBaseUrl() + "/api/trpc",
      }),
    }),
  ],
});

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

export function ChatClient() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setResponse("");
    setIsStreaming(true);

    try {
      const stream = await trpcClient.chat.query(message);

      for await (const character of stream) {
        setResponse((current) => current + character);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-50">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/40">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">
              tRPC v11 streaming chat
            </p>
            <h1 className="text-3xl font-semibold">AsyncGenerator demo</h1>
            <p className="text-sm leading-6 text-slate-300">
              Submit a message to stream it back one character at a time over
              standard HTTP.
            </p>
          </div>

          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="space-y-2" htmlFor="chat-input">
              <span className="text-sm text-slate-300">Message</span>
              <input
                id="chat-input"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type a message to stream"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base outline-none transition focus:border-cyan-400"
              />
            </label>

            <button
              id="chat-submit"
              type="submit"
              disabled={isStreaming || message.length === 0}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isStreaming ? "Streaming..." : "Send message"}
            </button>
          </form>

          <section className="mt-8 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
                Streamed response
              </h2>
              {isStreaming ? (
                <span className="text-sm text-cyan-400">Receiving chunks</span>
              ) : null}
            </div>
            <div
              id="chat-response"
              className="min-h-40 rounded-xl border border-slate-800 bg-slate-950/80 p-4 font-mono text-lg leading-8 text-cyan-100"
            >
              {response || "Response will appear here."}
            </div>
          </section>
        </div>
      </main>
    </QueryClientProvider>
  );
}
