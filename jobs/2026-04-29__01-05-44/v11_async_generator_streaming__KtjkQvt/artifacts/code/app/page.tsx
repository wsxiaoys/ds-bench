'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/client';

export default function Home() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const utils = trpc.useUtils();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input || isStreaming) return;

    setOutput('');
    setIsStreaming(true);

    try {
      // In tRPC v11, calling a query that returns an AsyncGenerator 
      // returns an AsyncGenerator on the client when using httpBatchStreamLink
      const stream = await (utils.client.chatStream.query as any)(input);
      
      for await (const chunk of stream) {
        setOutput((prev) => prev + chunk);
      }
    } catch (error) {
      console.error('Streaming error:', error);
      setOutput((prev) => prev + '\n[Error occurred during streaming]');
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center text-blue-600">
          tRPC v11 Async Generator Streaming
        </h1>
        
        <form onSubmit={handleSubmit} className="mb-8 w-full max-w-md mx-auto">
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type something..."
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={isStreaming || !input}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
            >
              {isStreaming ? 'Streaming...' : 'Send'}
            </button>
          </div>
        </form>

        <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md min-h-[200px] whitespace-pre-wrap text-black border border-gray-200">
          {output || (
            <span className="text-gray-400 italic">
              Streamed response will appear here...
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
