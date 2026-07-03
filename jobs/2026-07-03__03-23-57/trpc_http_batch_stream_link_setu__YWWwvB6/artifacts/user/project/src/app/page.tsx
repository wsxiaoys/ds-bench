'use client';

import { trpc } from '@/trpc/client';
import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('Hello AI');
  const [activePrompt, setActivePrompt] = useState('test');

  const chatStream = trpc.chatStream.useQuery(activePrompt, {
    enabled: activePrompt.length > 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      setActivePrompt(prompt);
    }
  };

  return (
    <main className="p-8 max-w-2xl mx-REDACTED flex flex-col gap-6">
      <h1 className="text-3xl font-bold">tRPC AI Streaming Chat</h1>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a prompt..."
          className="flex-1 border border-gray-300 rounded px-4 py-2 text-black"
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 text-white rounded px-6 py-2 font-medium"
        >
          Send
        </button>
      </form>

      <div className="border border-gray-200 rounded p-6 bg-gray-50 min-h-[150px] text-black">
        <h2 className="font-semibold mb-2 text-gray-700">Response:</h2>
        {chatStream.isLoading && <p className="text-gray-500">Loading...</p>}
        {chatStream.data && (
          <div className="whitespace-pre-wrap font-mono text-lg font-bold" id="chat-response">
            {chatStream.data.join('')}
          </div>
        )}
        {chatStream.isError && (
          <p className="text-red-500">Error: {chatStream.error.message}</p>
        )}
        {chatStream.data && chatStream.fetchStatus === 'idle' && (
          <p className="text-xs text-gray-400 mt-2">Streaming finished.</p>
        )}
      </div>
    </main>
  );
}
