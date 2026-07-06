'use client';

import { useState } from 'react';
import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from '@/server/routers/app';

// Set up the tRPC client using createTRPCClient and httpBatchStreamLink
const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: '/api/trpc',
    }),
  ],
});

export default function Home() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setResponse('');

    try {
      // Call the chat procedure and display the streamed characters
      const stream = await client.chat.query(input);
      
      for await (const chunk of stream) {
        setResponse((prev) => prev + chunk);
      }
    } catch (error) {
      console.error('Error during streaming:', error);
      setResponse((prev) => prev + '\n[Error: Failed to stream response]');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 font-sans dark:bg-black p-4">
      <main className="flex flex-col w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-xl shadow-md overflow-hidden border border-zinc-200 dark:border-zinc-800">
        {/* Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            tRPC v11 Streaming Chat
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Powered by tRPC v11 AsyncGenerator & httpBatchStreamLink
          </p>
        </div>

        {/* Response Display Area */}
        <div className="p-6 h-96 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/20 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Response
            </span>
            <div
              id="chat-response"
              className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 min-h-[100px] whitespace-pre-wrap break-words font-mono text-sm leading-relaxed"
            >
              {response || (isLoading ? '' : 'Submit a message below to start streaming...')}
            </div>
          </div>
        </div>

        {/* Input Form */}
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              id="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type something to stream back..."
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
            />
            <button
              id="chat-submit"
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Streaming...' : 'Send'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
